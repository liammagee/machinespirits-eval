import test from 'node:test';

test('captured deterministic failure sentinel', () => {
  throw new Error('captured deterministic failure body');
});
