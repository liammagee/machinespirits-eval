import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  analyzeDerivationLoopResults,
  globToRegExp,
  parseDerivationLabel,
} from '../scripts/analyze-derivation-loop-results.js';

function diagnosis({ verdict = 'grounded_anagnorisis', selected = 'none', gate = null, finalD = 0, turns = 10 } = {}) {
  return {
    verdict,
    turnsPlayed: turns,
    turnCap: 20,
    dCurve: [finalD],
    firstForcedTurn: verdict === 'grounded_anagnorisis' ? turns : null,
    assertedGroundedTurn: verdict === 'grounded_anagnorisis' ? turns : null,
    forcedToAssertedGap: verdict === 'grounded_anagnorisis' ? 0 : null,
    pacingGuard: selected === 'hidden',
    visibleGuard: selected === 'visible',
    pacingGuardSelector:
      gate || selected !== 'none'
        ? {
            schema: 'test.selector',
            selected,
            gate,
            selectedFlag: selected === 'hidden' ? '--pacing-guard' : '--pacing-guard-visible',
            rejected: selected === 'hidden' ? 'visible' : 'hidden',
          }
        : null,
    learnerInference: { overreachCount: 0 },
    eventsByType: {},
    releaseAdherence: { rows: [] },
    fabricatedFacts: [],
    usage: { calls: 1, byRole: { learner: { calls: 1 } } },
  };
}

function writeArm(loopDir, label, diag) {
  const dir = path.join(loopDir, label);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'diagnosis.json'), `${JSON.stringify(diag, null, 2)}\n`);
  writeFileSync(path.join(dir, 'result.json'), '{"transcript":[]}\n');
  writeFileSync(path.join(dir, 'transcript.md'), '# transcript\n');
}

test('parseDerivationLabel reads selector labels with optional versions', () => {
  assert.deepEqual(parseDerivationLabel('hethel-selector-v1-selective-r5'), {
    label: 'hethel-selector-v1-selective-r5',
    world: 'hethel',
    selectorVersion: 'v1',
    arm: 'selective',
    run: 5,
  });
  assert.deepEqual(parseDerivationLabel('withercombe-selector-hidden-r2'), {
    label: 'withercombe-selector-hidden-r2',
    world: 'withercombe',
    selectorVersion: null,
    arm: 'hidden',
    run: 2,
  });
  assert.equal(parseDerivationLabel('not-a-loop-label'), null);
});

test('globToRegExp supports simple label globs', () => {
  const rx = globToRegExp('*selector-v1-*');
  assert.equal(rx.test('hethel-selector-v1-visible-r4'), true);
  assert.equal(rx.test('hethel-selector-visible-r4'), false);
});

test('analyzeDerivationLoopResults groups rows, computes regret, and tracks missing labels', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'derivation-loop-analysis-'));
  const loopDir = path.join(root, 'loop');
  mkdirSync(loopDir, { recursive: true });

  writeArm(
    loopDir,
    'alpha-selector-v1-selective-r1',
    diagnosis({ selected: 'visible', gate: 'mirror_dead_predicate_visible', turns: 10 }),
  );
  writeArm(loopDir, 'alpha-selector-v1-visible-r1', diagnosis({ selected: 'visible', turns: 10 }));
  writeArm(
    loopDir,
    'alpha-selector-v1-hidden-r1',
    diagnosis({ verdict: 'disengagement', selected: 'hidden', finalD: 5, turns: 7 }),
  );
  writeArm(
    loopDir,
    'gamma-selector-v1-selective-r1',
    diagnosis({
      verdict: 'aporia',
      selected: 'visible',
      gate: 'mirror_dead_predicate_visible',
      finalD: 4,
      turns: 8,
    }),
  );
  writeArm(
    loopDir,
    'gamma-selector-v1-visible-r1',
    diagnosis({ verdict: 'aporia', selected: 'visible', finalD: 4, turns: 8 }),
  );
  writeArm(loopDir, 'gamma-selector-v1-hidden-r1', diagnosis({ selected: 'hidden', turns: 10 }));

  const summary = analyzeDerivationLoopResults({
    loopDir,
    patterns: ['*selector-v1-*'],
    expectedLabels: ['missing-selector-v1-selective-r1'],
    selectorVersion: 'v1',
  });

  assert.equal(summary.rows.length, 7);
  assert.equal(summary.rows.find((row) => row.label === 'missing-selector-v1-selective-r1').artifactStatus.status, 'missing');
  assert.equal(summary.regret.totals.selector.grounded, 1);
  assert.equal(summary.regret.totals.selector.n, 2);
  assert.equal(summary.regret.totals.hidden.grounded, 1);
  assert.equal(summary.regret.totals.hidden.n, 2);
  assert.equal(summary.regret.totals.oracleStatic.grounded, 2);
  assert.equal(summary.regret.totals.oracleStatic.n, 2);
  assert.equal(summary.failures.find((row) => row.label === 'gamma-selector-v1-selective-r1').kind, 'route_failure');
});

