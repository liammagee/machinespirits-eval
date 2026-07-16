import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildTutorStubTrajectoryShadowReport,
  renderTutorStubTrajectoryShadowMarkdown,
  summarizeTutorStubTrajectoryEpisode,
  TUTOR_STUB_TRAJECTORY_DEV_CORPUS_SCHEMA,
  TUTOR_STUB_TRAJECTORY_SHADOW_REPORT_SCHEMA,
} from '../services/tutorStubTrajectoryShadow.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CORPUS_PATH = path.join(ROOT, 'config', 'tutor-stub-trajectory-dev-v1.json');

function corpus() {
  return JSON.parse(fs.readFileSync(CORPUS_PATH, 'utf8'));
}

test('trajectory-dev-v1 is a complete, permanently non-held-out public corpus', () => {
  const fixture = corpus();
  assert.equal(fixture.schema, TUTOR_STUB_TRAJECTORY_DEV_CORPUS_SCHEMA);
  assert.equal(fixture.id, 'trajectory-dev-v1');
  assert.equal(fixture.heldOut, false);
  assert.equal(fixture.runtimeDeliveryGate, false);
  assert.equal(fixture.retroactiveRelabeling, false);
  assert.deepEqual(
    fixture.pairedReviews.map((row) => row.id),
    ['P01', 'P02', 'P03', 'P04', 'P05', 'P06'],
  );
  assert.deepEqual(
    fixture.calibrationCases.map((row) => row.expectedLabel),
    ['semantic_realization_structural_false_negative', 'genuine_performance_miss'],
  );
  assert.deepEqual(
    fixture.sequenceEpisodes.map((row) => [row.id, row.turns.length]),
    [
      ['ravensmark-affective-resistant-v18', 6],
      ['greyfen-answer-seeking-v19', 10],
      ['tallow-answer-seeking-v20-turns-1-5', 5],
      ['nocturne-answer-seeking-v22-turns-1-8', 8],
    ],
  );
  for (const paired of fixture.pairedReviews) {
    assert.match(paired.source.trace.sha256, /^[a-f0-9]{64}$/u);
    assert.ok(paired.context.length > 0);
    assert.ok(paired.learner.length > 0);
    assert.deepEqual(
      new Set(paired.candidates.map((candidate) => candidate.sourceClass)),
      new Set(['rejected_original', 'delivered_repair']),
    );
  }
  for (const episode of fixture.sequenceEpisodes) {
    assert.match(episode.source.trace.sha256, /^[a-f0-9]{64}$/u);
    assert.ok(episode.turns.every((turn) => turn.learner && turn.tutor));
  }
  const serialized = JSON.stringify(fixture);
  assert.doesNotMatch(serialized, /systemPrompt|firstDraftContract|learnerDagPreflight/u);
});

test('shadow report keeps hard integrity separate from sequence quality', () => {
  const report = buildTutorStubTrajectoryShadowReport(corpus());
  assert.equal(report.schema, TUTOR_STUB_TRAJECTORY_SHADOW_REPORT_SCHEMA);
  assert.equal(report.runtimeDeliveryGate, false);
  assert.equal(report.retroactiveRelabeling, false);
  assert.equal(report.hardIntegrity.ok, false, 'the known V20 surface duplicate remains a hard failure');
  assert.equal(report.hardIntegrity.failureCount, 1);
  assert.equal(report.hardIntegrity.counts.duplicateClueDelivery, 1);
  assert.equal(report.hardIntegrity.clueTransactions.due, 16);
  assert.equal(report.hardIntegrity.clueTransactions.released, 16);
  assert.equal(report.hardIntegrity.clueTransactions.missed, 0);
  assert.equal(report.sequenceQuality.aggregate.learnerUptake.rate, 1);
  assert.equal(report.sequenceQuality.aggregate.respondThenDevelop.rate, 1);
  assert.equal(report.sequenceQuality.aggregate.partAdaptation.rate, 0.56);
  assert.equal(report.sequenceQuality.aggregate.stanceAdaptation.rate, 0.68);
  assert.equal(report.sequenceQuality.exactPerTurnPartOrTacticIsRuntimeGate, false);
  assert.deepEqual(report.sequenceQuality.dimensions, [
    'learner_uptake',
    'respond_then_develop',
    'clue_pace',
    'continuity',
    'naturalness_boilerplate_proxies',
    'part_stance_adaptation',
    'closure_latency',
  ]);
  for (const episode of report.sequenceQuality.episodes) {
    const continuity = episode.sequenceQuality.continuity;
    if (continuity.learnerCarryoverEligible === 0) assert.equal(continuity.learnerCarryoverRate, null);
    else assert.ok(Number.isFinite(continuity.learnerCarryoverRate));
    assert.equal(episode.sequenceQuality.naturalness.interpretation, 'descriptive_proxy_only');
    assert.match(episode.sequenceQuality.closure.status, /^(?:not_reached|same_turn|delayed|missing)$/u);
  }
  const markdown = renderTutorStubTrajectoryShadowMarkdown(report);
  assert.match(markdown, /Clues/iu);
  assert.match(markdown, /Continuity \(learner \/ prior\)/u);
  assert.match(markdown, /Repeated 4-grams/u);
  assert.match(markdown, /Development-only pace probes: 2; observed\/scored: 0/u);
});

test('saved blind pairs preserve the observed repair-quality regression without changing a gate', () => {
  const review = buildTutorStubTrajectoryShadowReport(corpus()).pairedBlindReview;
  assert.equal(review.pairCount, 6);
  assert.equal(review.originalPreferred, 6);
  assert.equal(review.repairPreferred, 0);
  assert.equal(review.meanDeliveredMinusOriginal, -0.6);
  assert.equal(review.bySourceClass.rejected_original.overall, 4.267);
  assert.equal(review.bySourceClass.delivered_repair.overall, 3.667);
  assert.match(review.humanReviewDependency, /independent human/iu);
});

test('generic public structures recognize direct write uptake and same-turn closure', () => {
  const summary = summarizeTutorStubTrajectoryEpisode({
    id: 'generic-structure',
    turns: [
      {
        turn: 1,
        learner: 'What should I write next?',
        tutor: 'Write: “The current public record supports only a provisional finding.” Then examine the next public exhibit.',
        composition: { uptake: '', development: 'Then examine the next public exhibit.' },
        release: { dueNow: [], releasedNow: [], notDeliveredNow: [], direction: 'steady' },
        configuration: { part: 'examiner', stance: 'plain', tactic: 'unadorned_report', realizationRate: 1 },
        closure: { mandatory: false, closesDialogue: false },
        hardIntegrity: {},
      },
      {
        turn: 2,
        learner: 'The public exhibit settles the finding.',
        tutor: 'Yes. I enter that supported finding and close the inquiry.',
        composition: { uptake: 'Yes.', development: 'I enter that supported finding and close the inquiry.' },
        release: { dueNow: [], releasedNow: [], notDeliveredNow: [], direction: 'steady' },
        configuration: { part: 'record_keeper', stance: 'warm', tactic: 'shared_scene_invitation', realizationRate: 0.8 },
        closure: { mandatory: true, closesDialogue: true },
        hardIntegrity: {},
      },
    ],
  });
  assert.equal(summary.sequenceQuality.learnerUptake.rate, 1);
  assert.equal(summary.sequenceQuality.respondThenDevelop.rate, 1);
  assert.equal(summary.sequenceQuality.closure.status, 'same_turn');
  assert.equal(summary.sequenceQuality.closure.latencyTurns, 0);
  assert.equal(summary.sequenceQuality.adaptation.partTransitions, 1);
  assert.equal(summary.sequenceQuality.adaptation.stanceTransitions, 1);
});

test('synthetic pace probes remain unobserved development prompts and cannot become acceptance evidence', () => {
  const report = buildTutorStubTrajectoryShadowReport(corpus());
  assert.deepEqual(
    report.paceProbes.map((probe) => [probe.expectedDirection, probe.heldOut, probe.observed, probe.score]),
    [
      ['faster', false, false, null],
      ['slower', false, false, null],
    ],
  );
});

test('held-out or runtime-gating corpora are rejected', () => {
  const fixture = corpus();
  assert.throws(
    () => buildTutorStubTrajectoryShadowReport({ ...fixture, heldOut: true }),
    /permanently non-held-out/u,
  );
  assert.throws(
    () => buildTutorStubTrajectoryShadowReport({ ...fixture, runtimeDeliveryGate: true }),
    /cannot be a runtime gate/u,
  );
});
