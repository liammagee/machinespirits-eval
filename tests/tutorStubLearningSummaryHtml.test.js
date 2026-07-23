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
import { MACHINE_SPIRITS_HOUSE_STYLE_SCHEMA } from '../services/machineSpiritsHouseStyle.js';

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
      acceleratedTurnCount: 1,
      maxSupportedMoves: 3,
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
    learnerResponseProvenance: {
      counts: { human: 1, ai: 0, hybrid: 1, unknown: 0 },
    },
    journey: [
      {
        turn: 1,
        learner: 'What does blank mean?',
        learnerResponseProvenance: { authorship: 'human', inputMethod: 'terminal' },
        tutor: 'A blank is the metal piece before a coin is struck.',
        reading: 'The learner asked for a lexical explanation.',
        coverage: 0.25,
        newEvidence: [],
        newReasoning: [],
      },
      {
        turn: 2,
        learner: 'Then I would compare the residue.',
        learnerResponseProvenance: { authorship: 'hybrid', inputMethod: 'tab_completion_then_edit' },
        tutor: 'Yes—which crucible bears the same trace?',
        reading: 'The learner proposed a concrete evidentiary test.',
        coverage: 0.5,
        newEvidence: ['The residue matches the <mint crucible>.'],
        newReasoning: ['A matching residue can identify which crucible was used.'],
        learnerAdvance: {
          accelerated: true,
          supportedMoveCount: 3,
          adoptedPremiseCount: 2,
          derivedFactCount: 1,
        },
      },
    ],
    boundary: 'This report uses public dialogue evidence only.',
    tuning: {
      mode: 'on',
      activeRef: 'dramatic-detective@v1',
      sessionFeedbackCount: 1,
      promotionPolicy: 'candidate -> canary -> helpful replay validation -> stable promotion',
      candidates: [
        {
          id: 'cand-example',
          status: 'approval_required',
          evidence: { reasonLabel: 'too abstract' },
        },
      ],
    },
  };
}

test('learning summary HTML renders the learner arc, evidence, vocabulary, and journey safely', () => {
  const html = renderTutorStubLearningSummaryHtml(fixtureSummary());

  assert.match(html, /^<!doctype html>/u);
  assert.match(html, new RegExp(`data-machine-spirits-house-style="${MACHINE_SPIRITS_HOUSE_STYLE_SCHEMA}"`, 'u'));
  assert.match(html, new RegExp(`data-machine-spirits-house-backdrop="${MACHINE_SPIRITS_HOUSE_STYLE_SCHEMA}"`, 'u'));
  assert.match(
    html,
    new RegExp(`data-tutor-stub-learning-summary-style="${TUTOR_STUB_LEARNING_SUMMARY_HTML_SCHEMA}"`, 'u'),
  );
  assert.match(html, /<body class="ms-house-style learning-summary-page">/u);
  assert.match(html, /class="hero ms-panel"/u);
  assert.match(html, /class="ms-display"/u);
  assert.match(html, /Machine Spirits house style/u);
  assert.match(html, /The Light Shillings · what we learned/u);
  assert.match(html, /Whose hand struck the false shillings/u);
  assert.match(html, /You chose to end the session here/u);
  assert.match(html, /Reasoning you established/u);
  assert.match(html, /Evidence held by the end/u);
  assert.match(html, /How the reasoning developed/u);
  assert.match(html, /Turns with several supported steps:<\/b> 1/u);
  assert.match(html, /reasoning path complete/u);
  assert.match(html, /3 reasoning moves were accepted together/u);
  assert.match(html, /Connect the crucible to its documented user/u);
  assert.match(html, /blank/u);
  assert.match(html, /cupel/u);
  assert.match(html, /The residue matches the &lt;mint crucible&gt;/u);
  assert.match(html, /Tutor learning from this session/u);
  assert.match(html, /dramatic-detective@v1/u);
  assert.match(html, /cand-example/u);
  assert.match(html, /Human-authored learner response/u);
  assert.match(html, /Human-edited AI learner response/u);
  assert.match(html, /1 human-authored · 0 AI-authored · 1 human-edited AI/u);
  assert.doesNotMatch(html, /The residue matches the <mint crucible>/u);
  assert.doesNotMatch(html, /--paper:#f4efe4/u);
  assert.doesNotMatch(html, /font:16px\/1\.55 Georgia/u);
  assert.doesNotMatch(html, /(?:src|href)=["']https?:\/\//u);
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
