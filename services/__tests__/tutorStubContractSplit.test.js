import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  projectTutorStubSafetyContract,
  projectTutorStubTeachingCharter,
  projectTutorStubWorldSpeakerDagPrompt,
} from '../tutorStubWorldPromptContext.js';

const world = { rules: [{ gloss: 'rule one' }, { gloss: 'rule two' }] };

test('stage-1 split: safety + charter assembly is the historical prompt shape', () => {
  const joined = projectTutorStubWorldSpeakerDagPrompt(world, { ledgerTerm: 'notebook' });
  assert.equal(joined[0], '# Speaking-tutor evidence contract');
  assert.ok(
    joined.includes(
      'Never speculate about withheld evidence. The turn context will state exactly what evidence may enter the scene now.',
    ),
  );
  assert.equal(joined.filter((l) => /acknowledge it only as a hypothesis/.test(l)).length, 1);
  const conductIdx = joined.indexOf('Speaking conduct:');
  const hypothesisIdx = joined.findIndex((l) => /acknowledge it only as a hypothesis/.test(l));
  assert.ok(conductIdx >= 0 && hypothesisIdx > conductIdx, 'charter items follow the conduct header');
});

test('the licence line keeps its historical slot directly under the header', () => {
  const joined = projectTutorStubWorldSpeakerDagPrompt(world, { demandLicence: true });
  assert.match(joined[1], /^Exception, licensed per turn:/);
  const off = projectTutorStubWorldSpeakerDagPrompt(world, {});
  assert.equal(
    off.some((l) => /^Exception, licensed per turn:/.test(l)),
    false,
  );
});

test('document ownership: hypothesis rule is charter-only; withheld-evidence rule is safety-only', () => {
  const safety = projectTutorStubSafetyContract(world).join('\n');
  const charter = projectTutorStubTeachingCharter(world, {}).join('\n');
  assert.match(charter, /acknowledge it only as a hypothesis/);
  assert.doesNotMatch(safety, /acknowledge it only as a hypothesis/);
  assert.match(safety, /Never speculate about withheld evidence/);
  assert.doesNotMatch(charter, /Never speculate about withheld evidence/);
});
