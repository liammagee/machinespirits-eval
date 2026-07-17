import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTutorStubWorldScaffold } from '../services/tutorStubWorldScaffold.js';

const dispatchWorld = {
  title: 'The Noon Dispatch',
  question: 'Who signed the noon dispatch?',
  rules: [
    {
      id: 'R_dispatch_signer',
      if: [['sealKeeper', '?seal', '?person']],
      then: [['signedDispatchBy', '?dispatch', '?person']],
      gloss: 'The keeper of the dispatch seal signed the noon dispatch.',
    },
    {
      id: 'R_archive_index',
      if: [['sealKeeper', '?seal', '?person']],
      then: [['indexedSealBy', '?seal', '?person']],
      gloss: 'The keeper of the seal entered it in the archive index.',
    },
    {
      id: 'R_seal_recovered',
      if: [['recoveredFromDesk', '?seal', '?person']],
      then: [['sealKeeper', '?seal', '?person']],
      gloss: 'The desk recovery identifies who kept the seal.',
    },
  ],
};

const greenhouseWorld = {
  title: 'The Glasshouse Ledger',
  question: 'What caused the orchids to wilt?',
  rules: [
    {
      id: 'R_humidity',
      if: [['ventClosedAt', '?house', '?time']],
      then: [['humiditySpike', '?house', '?time']],
      gloss: 'A closed vent caused the measured humidity spike.',
    },
    {
      id: 'R_water',
      if: [['irrigationStoppedAt', '?house', '?time']],
      then: [['dryBedAt', '?house', '?time']],
      gloss: 'The stopped irrigation left the orchid bed dry.',
    },
  ],
};

test('ambiguous input rules stay unmapped even when the same predicate has one output rule', () => {
  const scaffold = buildTutorStubWorldScaffold({
    world: dispatchWorld,
    evidence: {
      premise: 'p_seal',
      fact: ['sealKeeper', 'redSeal', 'mara'],
      surface: 'Mara kept the red dispatch seal at noon.',
    },
  });

  assert.equal(scaffold.ruleId, null);
  assert.equal(scaffold.publicRelationMap, null);
  assert.match(scaffold.warrantFrame, /Ask what this stated clue tells us/iu);
  assert.doesNotMatch(scaffold.warrantFrame, /keeper.*signed|archive index/iu);
  assert.deepEqual(scaffold.ruleResolution, {
    predicate: 'sealKeeper',
    explicit_rule_id: null,
    explicit_rule_valid: null,
    input_rule_ids: ['R_dispatch_signer', 'R_archive_index'],
    output_rule_ids: ['R_seal_recovered'],
    candidate_rule_ids: ['R_dispatch_signer', 'R_archive_index', 'R_seal_recovered'],
    selected_rule_id: null,
    strategy: 'unmapped',
    ambiguous: true,
  });
});

test('an authored public_focus rule id explicitly disambiguates repeated predicate rules', () => {
  const scaffold = buildTutorStubWorldScaffold({
    world: dispatchWorld,
    evidence: {
      premise: 'p_seal',
      fact: ['sealKeeper', 'redSeal', 'mara'],
      surface: 'Mara kept the red dispatch seal at noon.',
      public_focus: {
        rule_id: 'R_dispatch_signer',
        relationship: 'direct',
        surface: 'who signed the noon dispatch',
      },
    },
  });

  assert.equal(scaffold.ruleId, 'R_dispatch_signer');
  assert.match(scaffold.warrantFrame, /signed the noon dispatch/iu);
  assert.equal(scaffold.publicRelationMap.relationship, 'direct');
  assert.equal(scaffold.ruleResolution.strategy, 'explicit_public_focus_rule');
  assert.equal(scaffold.ruleResolution.explicit_rule_valid, true);
  assert.equal(scaffold.ruleResolution.selected_rule_id, 'R_dispatch_signer');
});

test('an unrelated predicate may resolve through one unique output rule', () => {
  const scaffold = buildTutorStubWorldScaffold({
    world: greenhouseWorld,
    evidence: {
      premise: 'p_humidity',
      fact: ['humiditySpike', 'orchidHouse', 'dusk'],
      surface: 'The orchid-house gauge records a humidity spike at dusk.',
    },
  });

  assert.equal(scaffold.ruleId, 'R_humidity');
  assert.match(scaffold.warrantFrame, /closed vent caused/iu);
  assert.equal(scaffold.ruleResolution.strategy, 'unique_output_predicate');
  assert.deepEqual(scaffold.ruleResolution.input_rule_ids, []);
  assert.deepEqual(scaffold.ruleResolution.output_rule_ids, ['R_humidity']);
});
