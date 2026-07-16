import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadWorld } from '../services/dramaticDerivation/world.js';
import {
  auditTutorStubFrozenCandidate,
  TUTOR_STUB_FROZEN_REPLAY_SCHEMA,
  TUTOR_STUB_REGRESSION_FIXTURE_SCHEMA,
} from '../services/tutorStubFrozenReplay.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = path.join(ROOT, 'tests', 'fixtures', 'tutor-stub-first-draft');
const FIXTURE_PATHS = [
  path.join(FIXTURE_DIR, 'greyfen-answer-seeking-v19.json'),
  path.join(FIXTURE_DIR, 'skyway-answer-seeking-v18.json'),
];

function readFixture(fixturePath) {
  return JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
}

function worldForId(worldId) {
  const worldDir = path.join(ROOT, 'config', 'drama-derivation');
  const matches = fs
    .readdirSync(worldDir)
    .filter((name) => /^world-.*\.yaml$/u.test(name))
    .map((name) => loadWorld(path.join(worldDir, name)))
    .filter((world) => world.id === worldId);
  assert.equal(matches.length, 1, `expected one world for ${worldId}`);
  return matches[0];
}

test('frozen replay fixtures retain the exact public prefix and original speaker configuration', () => {
  for (const fixturePath of FIXTURE_PATHS) {
    const fixture = readFixture(fixturePath);
    assert.equal(fixture.schema, TUTOR_STUB_REGRESSION_FIXTURE_SCHEMA);
    assert.equal(fixture.cases.length, 4);
    for (const testCase of fixture.cases) {
      const bundle = testCase.bundle;
      assert.equal(bundle.schema, TUTOR_STUB_FROZEN_REPLAY_SCHEMA);
      assert.equal(bundle.request.provider, 'codex');
      assert.equal(bundle.request.model, 'gpt-5.6-terra');
      assert.equal(bundle.request.effort, 'low');
      assert.ok(bundle.request.messages.length >= 2);
      assert.equal(bundle.request.messages.at(-1).role, 'user');
      assert.match(bundle.request.messages.at(-1).content, /Tutor-only first-draft performance contract/u);
      assert.match(bundle.request.messages.at(-1).content, /ACT \+ ENACT/u);
      assert.ok(bundle.selectedResponseConfiguration?.actorial_part);
      assert.ok(Array.isArray(bundle.publicPremiseIds));
      assert.ok(Array.isArray(bundle.duePremiseIds));
      assert.ok(
        bundle.priorTurns.every((turn) =>
          Object.keys(turn).every((key) => ['turn', 'turnId', 'learner', 'tutor'].includes(key)),
        ),
      );
    }
  }
});

test('model-free corpus re-audits every saved candidate without regressing accepted deliveries', () => {
  const improvements = [];
  for (const fixturePath of FIXTURE_PATHS) {
    const fixture = readFixture(fixturePath);
    for (const testCase of fixture.cases) {
      const world = worldForId(testCase.worldId);
      for (const candidate of testCase.candidates) {
        const audit = auditTutorStubFrozenCandidate({
          bundle: testCase.bundle,
          world,
          text: candidate.text,
          deliveryConfiguration: candidate.deliveryConfiguration,
          candidateKind: candidate.kind,
        });
        if (candidate.recordedAuditOk) {
          assert.equal(
            audit.ok,
            true,
            `${testCase.id} ${candidate.kind} regressed: ${audit.hardFailureClusters.join(', ')}`,
          );
        } else if (audit.ok) {
          improvements.push(`${testCase.id}:${candidate.kind}`);
        }
      }
    }
  }
  assert.ok(improvements.length > 0, 'the corpus should identify audit-recognition improvements without calling them generation');
  assert.ok(
    improvements.some((row) => row.startsWith('2026-07-16T05-50-54-528Z:')),
    'at least one recognition improvement should come from the Greyfen corpus',
  );
});

test('original-only frozen audit still rejects concealed future evidence', () => {
  const fixture = readFixture(FIXTURE_PATHS[0]);
  const testCase = fixture.cases.find((row) => row.turn === 2);
  const world = worldForId(testCase.worldId);
  const audit = auditTutorStubFrozenCandidate({
    bundle: testCase.bundle,
    world,
    text: 'The Larkin unit ruined the Corvat line because its cracked seal exposed the flasks to G17.',
    candidateKind: 'original_candidate',
  });
  assert.equal(audit.ok, false);
  assert.equal(audit.safetyFailure, true);
  assert.ok(audit.hardFailureClusters.some((cluster) => cluster.startsWith('leak:')));
});
