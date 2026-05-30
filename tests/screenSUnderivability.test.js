import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDramas, deterministicMatch, screenDrama } from '../scripts/screen-s-underivability.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPEC = path.resolve(__dirname, '../config/poetics-calibration/oedipus-pilot-v1.yaml');

// The S-underivability screen guarantees the `none` arm is a clean control: S
// must not be recoverable from the learner-visible context K_L alone. The two
// load-bearing properties: (1) K_L EXCLUDES the secret + every director-side
// telegraph, and (2) a guess restating S is caught as derivable.
describe('screen-s-underivability', () => {
  it('loads only dramas carrying a secret, honouring --only', () => {
    const all = loadDramas(SPEC, null);
    assert.ok(all.length >= 2);
    const one = loadDramas(SPEC, ['D_OED1']);
    assert.equal(one.length, 1);
    assert.equal(one[0].id, 'D_OED1');
  });

  it('K_L excludes the secret and every director-side telegraph', () => {
    const [d] = loadDramas(SPEC, ['D_OED1']);
    const kLKeys = Object.keys(d.kL);
    // Only learner-visible fields.
    assert.deepEqual(kLKeys.sort(), ['discipline', 'learner_start_state', 'learner_voice', 'scene', 'topic'].sort());
    const blob = JSON.stringify(d.kL).toLowerCase();
    assert.ok(!blob.includes('zero-point') && !blob.includes('zero point')); // the secret mechanism
    assert.ok(!blob.includes('dramatic_shape'));
    assert.ok(!blob.includes('re-reads')); // dramatic_shape telegraph
    // The secret itself rides alongside (for the judge), never inside K_L.
    assert.ok(d.secret.fact.toLowerCase().includes('zero-point'));
  });

  it('deterministicMatch flags a guess that restates S, clears unrelated guesses', () => {
    const [d] = loadDramas(SPEC, ['D_OED1']);
    const restating = [{ fact: d.secret.fact, probability: 0.4 }];
    assert.equal(deterministicMatch(d.secret, restating).hit, true);
    const unrelated = [
      { fact: 'The reviewer simply misread the figure caption.', probability: 0.3 },
      { fact: 'A co-author used an outdated dataset.', probability: 0.2 },
    ];
    assert.equal(deterministicMatch(d.secret, unrelated).hit, false);
  });

  it('screenDrama (mock) returns a CLEAN verdict with no network', async () => {
    const [d] = loadDramas(SPEC, ['D_OED1']);
    const r = await screenDrama(d, { mock: true, candidates: 3, model: 'mock' });
    assert.equal(r.verdict, 'clean');
    assert.equal(r.derivable, false);
    assert.equal(r.candidates.length, 3);
  });
});
