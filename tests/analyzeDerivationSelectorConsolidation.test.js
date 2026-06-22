import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeRuns,
  classifyComparison,
  parseSelectorLabel,
  renderMarkdown,
} from '../scripts/analyze-derivation-selector-consolidation.js';

function run({
  label,
  arm,
  verdict = 'grounded_anagnorisis',
  selected = arm === 'hidden' ? 'hidden' : arm === 'visible' ? 'visible' : arm === 'baseline' ? 'none' : 'visible',
  gate = selected === 'visible' && arm.startsWith('selective') ? 'mirror_dead_predicate_visible' : null,
  turns = 12,
  finalD = verdict === 'grounded_anagnorisis' ? 0 : 2,
  dCurve = [2, 2, 1, finalD],
  intervention = null,
} = {}) {
  return {
    label,
    dir: `exports/dramatic-derivation/loop/${label}`,
    group: 'g',
    root: 'ravensmark-selector-test',
    arm,
    run: 1,
    worldId: 'world_009_ravensmark',
    verdict,
    grounded: verdict === 'grounded_anagnorisis',
    turns,
    finalD,
    selected,
    gate,
    overreach: 0,
    luckyLeap: 0,
    firstSecretDerivedTurn: verdict === 'grounded_anagnorisis' ? turns : null,
    deadPredicate: gate ? 'answerableFor' : null,
    firstDeadPredicateDerivedTurn: gate ? 6 : null,
    firstDeadPredicateVoicedTurn: gate ? 6 : null,
    guardInterventions: intervention ? [intervention] : [],
    nonProofReleases: [{ premise: 'p_clause', actualTurn: 8, plannedTurn: 8, status: 'on_cue' }],
    releaseTurns: { p_mark: 4, p_clause: 8, p_registry: turns },
    releaseByTurn: [],
    dCurve,
  };
}

test('parseSelectorLabel accepts explicit arms and selector-version arms', () => {
  assert.deepEqual(parseSelectorLabel('ravensmark-selector-vpositive-t15w12-selective-v2-r1'), {
    label: 'ravensmark-selector-vpositive-t15w12-selective-v2-r1',
    root: 'ravensmark-selector-vpositive-t15w12',
    arm: 'selective-v2',
    run: 1,
  });
  assert.deepEqual(parseSelectorLabel('withercombe-selector-hidden-r3'), {
    label: 'withercombe-selector-hidden-r3',
    root: 'withercombe-selector',
    arm: 'hidden',
    run: 3,
  });
});

test('classifyComparison marks strict V-positive only when hidden and baseline fail', () => {
  const c = classifyComparison([
    run({ label: 'g-baseline-r1', arm: 'baseline', verdict: 'aporia' }),
    run({ label: 'g-hidden-r1', arm: 'hidden', verdict: 'aporia', selected: 'hidden' }),
    run({ label: 'g-visible-r1', arm: 'visible' }),
    run({
      label: 'g-selective-v2-r1',
      arm: 'selective-v2',
      intervention: { turn: 5, guard: 'visible', kind: 'push', premise: 'p_mark' },
    }),
  ]);
  assert.equal(c.classification, 'strict_v_positive');
  assert.match(c.episodeCommands[0], /run-derivation-episode\.js/);
  assert.match(c.episodeCommands[0], /--pacing-guard-selective-v2 off/);
  assert.match(c.episodeCommands[0], /--pacing-guard-selective-v3 off/);
  assert.match(c.episodeCommands[0], /--pacing-guard on --pacing-guard-visible off/);
});

test('classifyComparison marks selected-visible all-grounded runs as false positives', () => {
  const c = classifyComparison([
    run({ label: 'g-baseline-r1', arm: 'baseline' }),
    run({ label: 'g-hidden-r1', arm: 'hidden', selected: 'hidden' }),
    run({ label: 'g-visible-r1', arm: 'visible' }),
    run({ label: 'g-selective-v2-r1', arm: 'selective-v2' }),
  ]);
  assert.equal(c.classification, 'false_positive');
  assert.ok(c.reasons.some((r) => r.includes('hidden or baseline also grounded')));
});

test('classifyComparison marks visible-selected failures against hidden as route failures', () => {
  const c = classifyComparison([
    run({ label: 'g-baseline-r1', arm: 'baseline', verdict: 'aporia' }),
    run({ label: 'g-hidden-r1', arm: 'hidden', selected: 'hidden' }),
    run({ label: 'g-visible-r1', arm: 'visible', verdict: 'aporia' }),
    run({ label: 'g-selective-v2-r1', arm: 'selective-v2', verdict: 'aporia' }),
  ]);
  assert.equal(c.classification, 'visible_route_failure');
});

test('analyzeRuns and renderMarkdown expose counts and replay commands', () => {
  const summary = analyzeRuns([
    run({ label: 'g-baseline-r1', arm: 'baseline' }),
    run({ label: 'g-hidden-r1', arm: 'hidden', selected: 'hidden' }),
    run({ label: 'g-visible-r1', arm: 'visible' }),
    run({
      label: 'g-selective-v2-r1',
      arm: 'selective-v2',
      intervention: { turn: 5, guard: 'visible', kind: 'push', premise: 'p_mark' },
    }),
  ]);
  assert.equal(summary.counts.false_positive, 1);
  const md = renderMarkdown(summary);
  assert.match(md, /Selector Consolidation Diagnostic/);
  assert.match(md, /false_positive/);
  assert.match(md, /Replay commands/);
});
