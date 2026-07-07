// Verify the INIT greedy yields the design's predicted sacrifice sets S.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { computeBlockade } from './decay-slot-blockade.mjs';

const REPO = '/Users/lmagee/Dev/machinespirits/machinespirits-eval-derivation';
const lib = await import(pathToFileURL(path.join(REPO, 'services/dramaticDerivation/index.js')).href);
const helpers = { factKey: lib.factKey, closure: lib.closure };

const expected = {
  '000-smoke': ['p4'],
  '001-nocturne': ['m_style', 'm_away', 'p_porter', 'm_guest'],
  '002-lantern': ['m_key', 'm_post', 'm_shutter'],
  '003-bitterwell': ['m_pits', 'm_drain'],
  '004-withercombe': ['m_taint', 'm_works', 'm_drain'],
};

let ok = true;
for (const [w, exp] of Object.entries(expected)) {
  const world = lib.loadWorld(path.join(REPO, `config/drama-derivation/world-${w}.yaml`));
  const { S, intactMembers, released, scheduledPaths } = computeBlockade(world, helpers);
  const got = [...S];
  const match = got.length === exp.length && exp.every((id) => S.has(id));
  if (!match) ok = false;
  console.log(
    `${w}: S=[${got.join(',')}] expected=[${exp.join(',')}] ${match ? 'OK' : 'MISMATCH'} | ` +
      `|S|=${got.length} released=${released.length} scheduledPaths=${scheduledPaths.length} intactMembers=[${[...intactMembers].join(',')}]`,
  );
}
console.log(ok ? 'ALL MATCH' : 'MISMATCH PRESENT');
process.exit(ok ? 0 : 1);
