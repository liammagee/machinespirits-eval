import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { classifyPoeticsConsensus, parseCriticFormString } from '../scripts/lib/poeticsConsensus.js';

describe('poetics four-critic consensus', () => {
  it('classifies 3-of-4 recognition as claimable', () => {
    const consensus = classifyPoeticsConsensus([
      { critic: 'qwen', form: 'recognition' },
      { critic: 'gemini', form: 'recognition' },
      { critic: 'sonnet', form: 'recognition' },
      { critic: 'deepseek', form: 'flat' },
    ]);
    assert.equal(consensus.claimStatus, 'claimable');
    assert.equal(consensus.consensusClass, 'recognition');
    assert.equal(consensus.disagreement, true);
  });

  it('classifies 2-of-4 recognition as boundary', () => {
    const consensus = classifyPoeticsConsensus([
      { critic: 'qwen', form: 'recognition' },
      { critic: 'gemini', form: 'flat' },
      { critic: 'sonnet', form: 'flat' },
      { critic: 'deepseek', form: 'recognition' },
    ]);
    assert.equal(consensus.claimStatus, 'boundary');
    assert.equal(consensus.consensusClass, 'boundary');
  });

  it('classifies 0-1-of-4 recognition as negative', () => {
    const consensus = classifyPoeticsConsensus([
      { critic: 'qwen', form: 'trap' },
      { critic: 'gemini', form: 'trap' },
      { critic: 'sonnet', form: 'trap' },
      { critic: 'deepseek', form: 'recognition' },
    ]);
    assert.equal(consensus.claimStatus, 'negative');
    assert.equal(consensus.consensusClass, 'trap');
  });

  it('marks under-scored items insufficient', () => {
    const consensus = classifyPoeticsConsensus([{ critic: 'qwen', form: 'recognition' }]);
    assert.equal(consensus.claimStatus, 'insufficient');
    assert.equal(consensus.consensusClass, 'recognition');
  });

  it('parses stored critic form strings', () => {
    assert.deepEqual(parseCriticFormString('qwen=flat,sonnet=recognition'), [
      { critic: 'qwen', form: 'flat' },
      { critic: 'sonnet', form: 'recognition' },
    ]);
  });
});
