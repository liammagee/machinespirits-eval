import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import yaml from 'yaml';

import {
  analyzeAccuracyCalibration,
  blindedItem,
  buildHumanLabelCsv,
  buildJudgePrompt,
  normalizeJudgeOutput,
} from '../scripts/calibrate-rubric-v3-accuracy.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packet = yaml.parse(
  fs.readFileSync(path.join(ROOT, 'config', 'rubrics', 'v3.0', 'content-accuracy-calibration.yaml'), 'utf8'),
);
const thresholds = yaml.parse(
  fs.readFileSync(path.join(ROOT, 'config', 'rubrics', 'v3.0', 'content-accuracy-promotion-thresholds.yaml'), 'utf8'),
);

test('accuracy packet has 15 balanced development items and five sealed held-out items', () => {
  assert.equal(packet.items.length, 20);
  const development = packet.items.filter((item) => item.split === 'development');
  const heldOut = packet.items.filter((item) => item.split === 'held_out');
  assert.equal(development.length, 15);
  assert.equal(heldOut.length, 5);
  for (const category of ['correct', 'minor_error', 'major_error', 'contested_interpretation', 'not_applicable']) {
    assert.equal(development.filter((item) => item.category === category).length, 3, category);
    assert.equal(heldOut.filter((item) => item.category === category).length, 1, category);
  }
});

test('blinded items and coder sheets do not reveal authored targets', () => {
  const item = packet.items[0];
  const blinded = blindedItem(item);
  assert.equal(blinded.item_id, item.id);
  assert.equal('category' in blinded, false);
  assert.equal('expected_score' in blinded, false);
  const csv = buildHumanLabelCsv(packet.items.slice(0, 2), 'coder-a');
  assert.match(csv, /^coder_id,item_id,applicability,content_accuracy_score,confidence,notes/mu);
  assert.doesNotMatch(csv, /correct|minor_error|major_error|contested_interpretation|not_applicable\n/u);
});

test('judge prompt makes N/A explicit and keeps authored labels hidden', () => {
  const prompt = buildJudgePrompt(packet.items.slice(0, 2));
  assert.match(prompt, /score=null and not_applicable=true/u);
  assert.match(prompt, /Never use 5 as a substitute for N\/A/u);
  assert.doesNotMatch(prompt, /expected_score/u);
  assert.doesNotMatch(prompt, /"category"/u);
});

test('judge output normalization requires one valid score per exact item', () => {
  const items = packet.items.filter((item) => item.split === 'held_out');
  const output = {
    scores: items.map((item) => ({
      item_id: item.id,
      score: item.expected_score,
      not_applicable: item.expected_applicability === 'not_applicable',
      reasoning: 'test',
    })),
  };
  const normalized = normalizeJudgeOutput(output, items);
  assert.equal(normalized.length, 5);
  assert.equal(normalized.at(-1).not_applicable, true);
  assert.throws(() => normalizeJudgeOutput({ scores: output.scores.slice(1) }, items), /item mismatch/u);
});

test('analysis applies the frozen gates to same-item and authored agreement', () => {
  const items = packet.items.filter((item) => item.split === 'development');
  const scores = items.map((item) => ({
    item_id: item.id,
    score: item.expected_score,
    not_applicable: item.expected_applicability === 'not_applicable',
  }));
  const report = analyzeAccuracyCalibration({
    items,
    thresholds,
    artifacts: [
      { judge: { label: 'claude' }, scores },
      { judge: { label: 'codex' }, scores },
    ],
  });
  assert.equal(report.machine_gates_pass, true);
  assert.equal(report.promotion_ready, false, 'human labels remain a mandatory gate');
  assert.equal(report.cross_judge[0].metrics.applicability_agreement, 1);
  assert.equal(report.authored[0].metrics.applicable_mae, 0);
});

test('two complete agreeing human coders can satisfy the final human gate', () => {
  const items = packet.items.filter((item) => item.split === 'development');
  const scores = items.map((item) => ({
    item_id: item.id,
    score: item.expected_score,
    not_applicable: item.expected_applicability === 'not_applicable',
  }));
  const humanLabelSets = ['coder-a', 'coder-b'].map((coder_id) => scores.map((score) => ({ ...score, coder_id })));
  const report = analyzeAccuracyCalibration({
    items,
    thresholds,
    humanLabelSets,
    artifacts: [
      { judge: { label: 'claude' }, scores },
      { judge: { label: 'codex' }, scores },
    ],
  });
  assert.equal(report.human.complete_anchor_items, 15);
  assert.equal(report.human.gates_pass, true);
  assert.equal(report.promotion_ready, true);
});
