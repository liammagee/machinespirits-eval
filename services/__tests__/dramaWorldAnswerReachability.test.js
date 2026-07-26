import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { loadWorld } from '../dramaticDerivation/world.js';
import { answerSurfaceMentioned } from '../dramaticDerivation/answerSurface.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const WORLD_DIR = path.join(ROOT, 'config/drama-derivation');

/**
 * A dialogue can only conclude when the learner states the answer and the
 * matcher recognises it. If the answer constant cannot be recovered from the
 * world's own prose about that answer, no learner will ever phrase it in a way
 * that closes the dialogue - the run burns its full turn budget and records
 * `assertedSecret: false`, which reads exactly like a learner who never
 * concluded. world-026 shipped that way and cost an entire pilot.
 *
 * Known-unreachable worlds are listed rather than silently tolerated. Each
 * needs an authoring fix: name the answer once as a contiguous phrase in the
 * surface. They are not normaliser bugs - closing them would need matching
 * across interposed words, which would also match an unrelated sentence that
 * happens to contain the same words scattered through it.
 */
const KNOWN_UNREACHABLE = new Map([
  ['world-021-clockwork-tribunal.yaml', 'surface splits "wardens ... quittance" across a clause'],
  ['world-030-rowan-flat.yaml', 'surface interposes an adjective: "the basin\'s flexible feed hose"'],
]);

function answerConstant(world) {
  const varIndex = world.questionPattern.findIndex((part) => typeof part === 'string' && part.startsWith('?'));
  return varIndex < 0 ? null : world.secret.fact[varIndex];
}

describe('drama world answer reachability', () => {
  const files = fs
    .readdirSync(WORLD_DIR)
    .filter((file) => file.endsWith('.yaml'))
    .sort();

  it('finds worlds to check', () => {
    assert.ok(files.length > 0, 'no drama worlds found');
  });

  for (const file of files) {
    it(`${file}: the answer is recoverable from the world's own answer surface`, () => {
      const world = loadWorld(path.join(WORLD_DIR, file));
      const answer = answerConstant(world);
      const surface = world.secret?.surface;
      if (!answer || !surface) return;

      const reachable = answerSurfaceMentioned(surface, answer);
      const known = KNOWN_UNREACHABLE.get(file);
      if (known) {
        assert.equal(reachable, false, `${file} is now reachable - drop it from KNOWN_UNREACHABLE (was: ${known})`);
        return;
      }
      assert.equal(
        reachable,
        true,
        `${file}: the answer constant "${answer}" cannot be found in secret.surface, so a learner ` +
          `naming it from the world's own words will never satisfy closure. Name the answer once as a ` +
          `contiguous phrase in the surface, or add the world to KNOWN_UNREACHABLE with a reason.`,
      );
    });
  }
});
