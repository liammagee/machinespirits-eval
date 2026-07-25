import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TUTOR_STUB_TRAINING_REUSE_SCHEMA,
  normalizeTutorStubHumanSubjectClass,
  normalizeTutorStubTrainingReuseSetting,
  resolveTutorStubTrainingReuse,
  tutorStubTrainingReuseLabel,
} from '../services/tutorStubTrainingReuse.js';

test('owner-operated human or mixed sessions default to training-candidate status', () => {
  const reuse = resolveTutorStubTrainingReuse();

  assert.equal(reuse.schema, TUTOR_STUB_TRAINING_REUSE_SCHEMA);
  assert.equal(reuse.requested, 'on');
  assert.equal(reuse.effective, 'on');
  assert.equal(reuse.status, 'training_candidate');
  assert.equal(reuse.humanSubjectClass, 'owner_operator');
  assert.equal(reuse.scope, 'source_and_descendants');
  assert.deepEqual(reuse.appliesToAuthorship, ['human', 'hybrid']);
  assert.equal(tutorStubTrainingReuseLabel(reuse), 'training candidate');
});

test('owner opt-out applies do-not-train status to the source and descendants', () => {
  const reuse = resolveTutorStubTrainingReuse({ requested: 'off', source: 'cli_opt_out' });

  assert.equal(reuse.effective, 'off');
  assert.equal(reuse.status, 'do_not_train');
  assert.equal(reuse.reason, 'sole_owner_opt_out');
  assert.equal(reuse.source, 'cli_opt_out');
  assert.equal(tutorStubTrainingReuseLabel(reuse), 'do not train');
});

test('external and unknown human data fail closed even when reuse is requested', () => {
  for (const humanSubjectClass of ['external_user', 'unknown', 'not_applicable']) {
    const reuse = resolveTutorStubTrainingReuse({ requested: 'on', humanSubjectClass });
    assert.equal(reuse.requested, 'on');
    assert.equal(reuse.effective, 'off');
    assert.equal(reuse.status, 'do_not_train');
    assert.equal(reuse.failClosed, true);
    assert.equal(reuse.reason, 'external_or_unknown_human_data_fail_closed');
  }
});

test('automated-only sessions leave the human reuse control not applicable', () => {
  const reuse = resolveTutorStubTrainingReuse({ humanInputExpected: false });

  assert.equal(reuse.humanSubjectClass, 'not_applicable');
  assert.equal(reuse.declaredHumanSubjectClass, 'owner_operator');
  assert.equal(reuse.status, 'not_applicable');
  assert.equal(reuse.effective, 'off');
});

test('training reuse settings and human subject classes normalize conservatively', () => {
  assert.equal(normalizeTutorStubTrainingReuseSetting(true), 'on');
  assert.equal(normalizeTutorStubTrainingReuseSetting('do-not-train'), 'off');
  assert.equal(normalizeTutorStubHumanSubjectClass('external-user'), 'external_user');
  assert.throws(() => normalizeTutorStubTrainingReuseSetting('maybe'), /must be on or off/u);
  assert.throws(() => normalizeTutorStubHumanSubjectClass('participant'), /must be owner_operator/u);
});
