import assert from 'node:assert/strict';
import test from 'node:test';

import { deterministicTutorStubDramaticReleaseFallback } from '../services/tutorStubDramaticRelease.js';
import { deterministicTutorStubLearnerUptake } from '../services/tutorStubResponseComposition.js';
import {
  TUTOR_STUB_SCENE_DICTION_CONTEMPORARY,
  TUTOR_STUB_SCENE_DICTION_PERIOD,
  resolveTutorStubSceneDiction,
  tutorStubSceneLedgerTerm,
  tutorStubScenePublicObjects,
} from '../services/tutorStubSceneDiction.js';

const DOMESTIC_WORLD = {
  id: 'world_030_rowan_flat',
  presentation: {
    scene_ecology: 'shared apartment kitchen and bathroom',
    narrative_diction: 'domestic plainspoken',
    ledger_term: 'repair notebook',
  },
};

const PERIOD_WORLD = {
  id: 'world_005_marrick',
  presentation: {
    narrative_diction: 'medieval guild-hall formal',
    ledger_term: 'trial-book',
  },
};

function exhibitFrame() {
  return {
    active: true,
    entries: [
      {
        mode: 'exhibit',
        role: 'flatmate',
        surface: 'Sam’s shower ran from 08:05 to 08:13.',
        text: 'Sam’s shower ran from 08:05 to 08:13.',
      },
    ],
  };
}

function fallbackFor(world) {
  return deterministicTutorStubDramaticReleaseFallback({
    frame: exhibitFrame(),
    responseConfiguration: { engagement_stance: 'plain', actorial_host_part: 'examiner' },
    world,
  });
}

test('scene diction resolves period unless the world declares a marker-free costume', () => {
  assert.equal(resolveTutorStubSceneDiction(null), TUTOR_STUB_SCENE_DICTION_PERIOD);
  assert.equal(resolveTutorStubSceneDiction({}), TUTOR_STUB_SCENE_DICTION_PERIOD);
  assert.equal(resolveTutorStubSceneDiction(PERIOD_WORLD), TUTOR_STUB_SCENE_DICTION_PERIOD);
  assert.equal(
    resolveTutorStubSceneDiction({ presentation: { narrative_diction: 'late-romantic archival formal' } }),
    TUTOR_STUB_SCENE_DICTION_PERIOD,
  );
  assert.equal(resolveTutorStubSceneDiction(DOMESTIC_WORLD), TUTOR_STUB_SCENE_DICTION_CONTEMPORARY);
  assert.equal(
    resolveTutorStubSceneDiction({ presentation: { narrative_diction: 'newsroom noir' } }),
    TUTOR_STUB_SCENE_DICTION_CONTEMPORARY,
  );
});

test('declared props are read from the world, longest first', () => {
  assert.equal(tutorStubSceneLedgerTerm(DOMESTIC_WORLD), 'repair notebook');
  assert.equal(tutorStubSceneLedgerTerm(null), '');
  assert.deepEqual(
    tutorStubScenePublicObjects({
      presentation: { ledger_term: 'repair notebook', public_objects: ['hose', 'shared calendar'] },
    }),
    ['repair notebook', 'shared calendar', 'hose'],
  );
});

test('the deterministic release fallback keeps the frozen period wording by default', () => {
  const frozen = 'I examine the record: Sam’s shower ran from 08:05 to 08:13.';
  assert.ok(fallbackFor(null).startsWith(frozen), fallbackFor(null));
  assert.ok(fallbackFor(PERIOD_WORLD).startsWith(frozen), fallbackFor(PERIOD_WORLD));
});

test('a contemporary world speaks its own prop in its own register', () => {
  const spoken = fallbackFor(DOMESTIC_WORLD);
  assert.ok(spoken.startsWith('I look at the repair notebook:'), spoken);
  assert.ok(!/I examine the record/u.test(spoken), spoken);
});

test('the generic learner uptake tail follows the declared diction', () => {
  const uptakeFor = (world) =>
    deterministicTutorStubLearnerUptake({
      learnerText: 'But that does not tell us who left the tap running.',
      classification: { turn: { request_type: null, discourse_move: null } },
      world,
    });
  assert.equal(uptakeFor(null), 'I hear the point; the next public fact must answer it.');
  assert.equal(uptakeFor(PERIOD_WORLD), 'I hear the point; the next public fact must answer it.');
  assert.equal(uptakeFor(DOMESTIC_WORLD), 'Fair point—the next thing we check has to answer it.');
});
