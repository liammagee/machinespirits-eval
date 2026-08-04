import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  extractFramingTrajectoryChecks,
  lexicalDistance,
  summarizeFramingTrajectoryCodes,
} from '../services/superegoFramingTrajectoryAnalyzer.js';

const TRACE = [
  {
    agent: 'ego',
    action: 'generate',
    round: 0,
    suggestions: [{ type: 'lecture', actionTarget: 'a', message: 'Explain the same fixed answer directly.' }],
  },
  {
    agent: 'superego',
    action: 'review',
    round: 1,
    approved: false,
    interventionType: 'revise',
    feedback: 'Invite the learner to test the premise rather than announcing the answer.',
  },
  {
    agent: 'ego',
    action: 'revise',
    round: 1,
    suggestions: [{ type: 'explore', actionTarget: 'b', message: 'Which premise would you test first, and why?' }],
  },
  { agent: 'user', action: 'final_output', turnIndex: 0 },
  { agent: 'user', action: 'turn_action', turnIndex: 1, detail: 'I would test the second premise.' },
  {
    agent: 'ego',
    action: 'generate',
    round: 0,
    suggestions: [{ type: 'explore', actionTarget: 'b', message: 'Let us keep testing the second premise.' }],
  },
  {
    agent: 'superego',
    action: 'review',
    round: 1,
    approved: false,
    interventionType: 'enhance',
    feedback: 'Ask for evidence.',
  },
  { agent: 'user', action: 'turn_action', turnIndex: 2, detail: 'Here is my evidence.' },
  {
    agent: 'ego',
    action: 'generate',
    round: 0,
    suggestions: [{ type: 'explore', actionTarget: 'b', message: 'What evidence supports that premise?' }],
  },
];

describe('extractFramingTrajectoryChecks', () => {
  it('links an intervention to its preceding response and immediate ego revision', () => {
    const checks = extractFramingTrajectoryChecks(TRACE, {
      dialogueId: 'dialogue-a',
      runId: 'run-a',
      profileName: 'cell-a',
      scenarioId: 'scenario-a',
      sourceTraceSha256: 'abc123',
    });

    assert.equal(checks.length, 2);
    assert.equal(checks[0].checkId, 'dialogue-a#check-1');
    assert.equal(checks[0].requiresRevision, true);
    assert.equal(checks[0].followupKind, 'immediate');
    assert.equal(checks[0].nextEgo.action, 'revise');
    assert.equal(checks[0].immediateRevisionSignal, true);
    assert.match(checks[0].disciplinaryCheck.text, /test the premise/u);
    assert.match(checks[0].nextEgo.text, /Which premise/u);
  });

  it('marks a next ego response after learner uptake as deferred and ineligible', () => {
    const checks = extractFramingTrajectoryChecks(TRACE, { dialogueId: 'dialogue-a' });
    assert.equal(checks[1].followupKind, 'after_learner_uptake');
    assert.equal(checks[1].immediateRevisionSignal, false);
  });

  it('recomputes the existing dialogue-level incorporation count proxy', () => {
    const checks = extractFramingTrajectoryChecks(TRACE, { dialogueId: 'dialogue-a' });
    assert.equal(checks[0].dialogueIncorporationRate, 0.5);
    assert.equal(checks[1].dialogueIncorporationRate, 0.5);
  });
});

describe('lexicalDistance', () => {
  it('returns zero for equivalent token sets and one for disjoint text', () => {
    assert.equal(lexicalDistance('same words', 'words same'), 0);
    assert.equal(lexicalDistance('alpha', 'beta'), 1);
  });
});

describe('summarizeFramingTrajectoryCodes', () => {
  const eligible = extractFramingTrajectoryChecks(TRACE, {
    dialogueId: 'dialogue-a',
    profileName: 'cell-a',
    sourceTraceSha256: 'abc123',
  }).slice(0, 1);

  it('compares semantic codes with structural proxy signals and preserves missingness', () => {
    const summary = summarizeFramingTrajectoryCodes(eligible, [
      {
        check_id: 'dialogue-a#check-1',
        source_trace_sha256: 'abc123',
        label: 'restate',
        rationale: 'The wording changes, but the same organizing frame remains.',
      },
    ]);

    assert.equal(summary.codedChecks, 1);
    assert.equal(summary.labels.restate, 1);
    assert.equal(summary.comparison.dialogueProxyMatrix.proxy_positive_restate, 1);
    assert.equal(summary.comparison.immediateRevisionAgreement, 0);
    assert.equal(summary.comparison.dbIncorporationMissing, 1);
    assert.equal(summary.comparison.dimensionConvergenceMissing, 1);
  });

  it('rejects deferred, duplicate, unknown, and unreasoned codes', () => {
    const allChecks = extractFramingTrajectoryChecks(TRACE, {
      dialogueId: 'dialogue-a',
      sourceTraceSha256: 'abc123',
    });
    assert.throws(
      () =>
        summarizeFramingTrajectoryCodes(allChecks, [
          { check_id: 'dialogue-a#check-2', source_trace_sha256: 'abc123', label: 'reframe', rationale: 'Deferred.' },
        ]),
      /not an immediate revision-demanding trajectory/u,
    );
    assert.throws(
      () =>
        summarizeFramingTrajectoryCodes(allChecks, [
          { check_id: 'missing', source_trace_sha256: 'abc123', label: 'reframe', rationale: 'x' },
        ]),
      /Unknown/u,
    );
    assert.throws(
      () =>
        summarizeFramingTrajectoryCodes(allChecks, [
          { check_id: 'dialogue-a#check-1', source_trace_sha256: 'abc123', label: 'reframe', rationale: '' },
        ]),
      /Missing rationale/u,
    );
    assert.throws(
      () =>
        summarizeFramingTrajectoryCodes(allChecks, [
          { check_id: 'dialogue-a#check-1', source_trace_sha256: 'abc123', label: 'reframe', rationale: 'x' },
          { check_id: 'dialogue-a#check-1', source_trace_sha256: 'abc123', label: 'restate', rationale: 'x' },
        ]),
      /Duplicate/u,
    );
  });
});
