import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isPidAlive } from '../services/processUtils.js';

describe('isPidAlive', () => {
  it('returns null for falsy pid', () => {
    assert.equal(isPidAlive(null), null);
    assert.equal(isPidAlive(undefined), null);
    assert.equal(isPidAlive(0), null);
  });

  it('returns null for non-number pid', () => {
    assert.equal(isPidAlive('123'), null);
    assert.equal(isPidAlive({}), null);
  });

  it('returns true for own process pid', () => {
    // Current process is always alive
    assert.equal(isPidAlive(process.pid), true);
  });

  it('returns false for a dead pid', () => {
    // PID 99999999 is almost certainly not running
    const result = isPidAlive(99999999);
    assert.equal(result, false);
  });
});
