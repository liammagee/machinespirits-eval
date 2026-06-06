import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { reportCueMapRisk } from '../scripts/report-recursive-tutor-cue-map-risk.js';

const ROOT = path.resolve('.');
const CUE_MAP = path.join(ROOT, 'config', 'recursive-tutor-learning', 'a18-post-v2-cue-maps.yaml');

test('cue-map reporter passes prior selector-family positive control', () => {
  const report = reportCueMapRisk({
    configPath: path.join(ROOT, 'config', 'recursive-tutor-learning', 'underdetermined-transfer-families.yaml'),
    cueMapPath: CUE_MAP,
    familyId: 'selector_rail_priority',
  });

  assert.equal(report.status, 'pass');
  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].status, 'pass');
  assert.deepEqual(report.rows[0].issues, []);
});

test('cue-map reporter passes prior bead-family positive control', () => {
  const report = reportCueMapRisk({
    configPath: path.join(ROOT, 'config', 'recursive-tutor-learning', 'underdetermined-transfer-families.yaml'),
    cueMapPath: CUE_MAP,
    familyId: 'bead_predecessor_priority',
  });

  assert.equal(report.status, 'pass');
  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].status, 'pass');
  assert.deepEqual(report.rows[0].issues, []);
});

test('cue-map reporter passes fresh fold-anchor candidate', () => {
  const report = reportCueMapRisk({
    configPath: path.join(ROOT, 'config', 'recursive-tutor-learning', 'a18.32-fresh-family-cue-pass.yaml'),
    cueMapPath: CUE_MAP,
    familyId: 'fold_anchor_priority',
  });

  assert.equal(report.status, 'pass');
  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].status, 'pass');
  assert.deepEqual(report.rows[0].issues, []);
});

test('cue-map reporter flags diagonal-socket inverse instability', () => {
  const report = reportCueMapRisk({
    configPath: path.join(ROOT, 'config', 'recursive-tutor-learning', 'a18.25-fresh-family-v2.yaml'),
    cueMapPath: CUE_MAP,
    familyId: 'diagonal_socket_priority',
  });

  assert.equal(report.status, 'fail');
  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].status, 'fail');
  assert.ok(report.rows[0].issues.some((issue) => issue.code === 'inverse_rule_instability_risk'));
  assert.ok(report.rows[0].issues.some((issue) => issue.code === 'target_salience_overload'));
});

test('cue-map reporter flags thread-source public self-solving', () => {
  const report = reportCueMapRisk({
    configPath: path.join(ROOT, 'config', 'recursive-tutor-learning', 'a18.28-fresh-family-non-inverse.yaml'),
    cueMapPath: CUE_MAP,
    familyId: 'thread_source_priority',
  });

  assert.equal(report.status, 'fail');
  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].status, 'fail');
  assert.ok(report.rows[0].issues.some((issue) => issue.code === 'public_self_solving_risk'));
  assert.ok(report.rows[0].issues.some((issue) => issue.code === 'marker_too_narrow'));
});
