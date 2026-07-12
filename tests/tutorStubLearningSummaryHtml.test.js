import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  TUTOR_STUB_LEARNING_SUMMARY_HTML_SCHEMA,
  renderTutorStubLearningSummaryHtml,
  writeTutorStubLearningSummaryHtml,
} from '../services/tutorStubLearningSummaryHtml.js';

function fixtureSummary() {
  return {
    schema: TUTOR_STUB_LEARNING_SUMMARY_HTML_SCHEMA,
    generatedAt: '2026-07-12T00:00:00.000Z',
    runId: 'summary-test',
    reason: 'exit',
    turnCount: 2,
    world: {
      title: 'The Light Shillings',
      question: 'Whose hand struck the false shillings?',
    },
    completion: {
      natural: false,
      plainReason: 'You chose to end the session here.',
    },
    finalStatus: 'The learner has established a useful evidentiary link.',
    progress: {
      bestPathCoverage: 0.5,
      plainStatus: 'The learner can now connect the residue to a specific crucible.',
    },
    arc: {
      summary: 'The learner moved from uncertainty to a concrete comparison.',
      trajectory: 'The second turn made the evidentiary test explicit.',
    },
    evidenceHeld: ['The residue matches the <mint crucible>.'],
    reasoningVoiced: ['A matching residue can identify which crucible was used.'],
    comprehension: {
      explainedTerms: ['blank'],
      unresolvedTerms: ['cupel'],
    },
    openQuestions: ['Who alone used that crucible?'],
    nextStep: 'Connect the crucible to its documented user.',
    journey: [
      {
        turn: 1,
        learner: 'What does blank mean?',
        tutor: 'A blank is the metal piece before a coin is struck.',
        reading: 'The learner asked for a lexical explanation.',
        coverage: 0.25,
        newEvidence: [],
        newReasoning: [],
      },
      {
        turn: 2,
        learner: 'Then I would compare the residue.',
        tutor: 'Yes—which crucible bears the same trace?',
        reading: 'The learner proposed a concrete evidentiary test.',
        coverage: 0.5,
        newEvidence: ['The residue matches the <mint crucible>.'],
        newReasoning: ['A matching residue can identify which crucible was used.'],
      },
    ],
    boundary: 'This report uses public dialogue evidence only.',
  };
}

test('learning summary HTML renders the learner arc, evidence, vocabulary, and journey safely', () => {
  const html = renderTutorStubLearningSummaryHtml(fixtureSummary());

  assert.match(html, /^<!doctype html>/u);
  assert.match(html, /The Light Shillings · what we learned/u);
  assert.match(html, /Whose hand struck the false shillings/u);
  assert.match(html, /You chose to end the session here/u);
  assert.match(html, /Reasoning you established/u);
  assert.match(html, /Evidence held by the end/u);
  assert.match(html, /How the reasoning developed/u);
  assert.match(html, /Connect the crucible to its documented user/u);
  assert.match(html, /blank/u);
  assert.match(html, /cupel/u);
  assert.match(html, /The residue matches the &lt;mint crucible&gt;/u);
  assert.doesNotMatch(html, /The residue matches the <mint crucible>/u);
});

test('learning summary writer creates its destination directory', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-learning-summary-html-'));
  try {
    const filePath = path.join(tmp, 'nested', 'summary.html');
    const written = writeTutorStubLearningSummaryHtml({ summary: fixtureSummary(), filePath });

    assert.equal(written, path.resolve(filePath));
    assert.ok(fs.existsSync(written));
    assert.match(fs.readFileSync(written, 'utf8'), /Tutor stub · what we learned/u);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
