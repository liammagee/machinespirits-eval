import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  OUTCOME_STUDY_DEFAULT_LEARNER_PROFILE,
  OUTCOME_STUDY_SUPPORTED_LEARNER_PROFILES,
} from '../services/adaptiveWarrantOutcomeLearnerProfiles.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function sha256(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

test('the two established resistant learner profile IDs remain compatibility keys', () => {
  assert.equal(OUTCOME_STUDY_DEFAULT_LEARNER_PROFILE, 'low_agency');
  assert.ok(OUTCOME_STUDY_SUPPORTED_LEARNER_PROFILES.includes('low_agency'));
  assert.ok(OUTCOME_STUDY_SUPPORTED_LEARNER_PROFILES.includes('overconfident'));
});

test('the low-agency claim surface preserves its result and attribution boundaries', () => {
  const paper = read('docs/research/paper-full-2.0.md');
  const card = read('workplan/items/adaptive-warrant-outcome-study.md');
  for (const surface of [paper, card]) {
    assert.match(surface, /19\/24 gated/u);
    assert.match(surface, /10\/24 bare/u);
    assert.match(surface, /11\/24 standing/u);
    assert.match(surface, /87\.5%/u);
    assert.match(surface, /64\.8%/u);
    assert.match(surface, /68\.3%/u);
    assert.match(surface, /always-on steering/u);
  }
  assert.match(card, /83\.80% gated vs 71\.84%\s+steering-only/u);
  assert.match(card, /No further paid run is authorized under this arc/u);
});

test('the overconfident claim surface preserves numbers and mandatory qualifiers', () => {
  const paper = read('docs/research/paper-full-2.0.md');
  const card = read('workplan/items/guarded-learner-outcome-study.md');
  for (const surface of [paper, card]) {
    assert.match(surface, /40\.8%/u);
    assert.match(surface, /31\.2%/u);
    assert.match(surface, /17\.8%/u);
    assert.match(surface, /7\/66/u);
    assert.match(surface, /13\/152/u);
    assert.match(surface, /late-scored registered endpoint,\s+disclosed instrument amendment/iu);
    assert.match(surface, /no effect-size/u);
    assert.match(surface, /human-learning/u);
  }
});

test('the guarded schema evidence is checkout-portable and hash-bound', () => {
  const freeze = JSON.parse(read('docs/adaptation-refinement/guarded-pilot/guarded-instrument-freeze.json'));
  const acceptanceBinding = freeze.semantic_instrument.schema_acceptance;
  assert.equal(path.isAbsolute(acceptanceBinding.path), false);
  const acceptancePath = path.resolve(ROOT, acceptanceBinding.path);
  assert.equal(sha256(acceptancePath), acceptanceBinding.sha256);

  const acceptance = JSON.parse(fs.readFileSync(acceptancePath, 'utf8'));
  assert.equal(path.isAbsolute(acceptance.response_schema.path), false);
  const schemaPath = path.resolve(ROOT, acceptance.response_schema.path);
  assert.equal(sha256(schemaPath), acceptance.response_schema.sha256);
});

test('the integration programme keeps register downstream of action and authorizes no paid call', () => {
  const card = read('workplan/items/resistance-action-register-integration.md');
  const contract = read('docs/pedagogical-move-contract.md');
  assert.match(card, /pedagogical action -> compatible register/u);
  assert.match(card, /No paid call is authorized by this card/u);
  assert.match(contract, /PedagogicalMove -> register\/character realization/u);
  assert.match(contract, /consumer_switch_authorized: false/u);
  assert.match(contract, /Neither projection is imported by a live runtime/u);
});
