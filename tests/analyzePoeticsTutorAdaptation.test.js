import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { analyzeTraceForTutorAdaptation, markerReframeScore } from '../scripts/analyze-poetics-tutor-adaptation.js';

function turn(phase, turnNumber, externalMessage, extra = {}) {
  return { phase, turnNumber, externalMessage, ...extra };
}

function reframeTrace(postTutorMessage) {
  const anchor = 'The map proves Greenland is nearly Africa sized.';
  return {
    turns: [
      turn('learner', 1, anchor),
      turn('tutor', 1, 'Maps can make shapes look larger or smaller because projection changes visual size.'),
      turn('learner', 2, 'So I should trust the big shape on the page.'),
      turn(
        'tutor',
        2,
        'Start by asking what the map is designed to preserve, then compare it with another evidence source.',
      ),
      turn(
        'director',
        3,
        `A prior learner line is played back: "${anchor}" The learner must revoice that wording first, name the earlier framing problem, and give a replacement frame.`,
        { directorCue: { cueKind: 'learner_revisit_earlier_wording', revisitPolicy: 'reframe' } },
      ),
      turn(
        'learner',
        3,
        `${anchor} The problem was my old framing: I treated projection size as area proof. The better reading is that the map projection distorts area, so the question should ask for scale evidence.`,
      ),
      turn('tutor', 3, postTutorMessage),
    ],
  };
}

describe('poetics tutor adaptation analyzer', () => {
  it('separates learner self-reframe from tutor uptake when the tutor adapts', () => {
    const row = analyzeTraceForTutorAdaptation({
      itemId: 'positive',
      trace: reframeTrace(
        'Take that frame forward: projection and area are now separate. Check the scale evidence before calling Greenland Africa-sized.',
      ),
      sourceTracePath: '/tmp/positive.json',
    });

    assert.equal(row.learnerSelfReframe, true);
    assert.equal(row.tutorContingentAdaptation, true);
    assert.equal(row.tutorPostTurn, 3);
    assert.ok(row.tutorAdaptationScore > 50);
    assert.ok(row.sharedSalientTerms.includes('projection'));
  });

  it('does not treat learner self-reframe alone as tutor adaptation', () => {
    const row = analyzeTraceForTutorAdaptation({
      itemId: 'negative',
      trace: reframeTrace('Next, memorize the country list and copy three names from the worksheet.'),
      sourceTracePath: '/tmp/negative.json',
    });

    assert.equal(row.learnerSelfReframe, true);
    assert.equal(row.tutorContingentAdaptation, false);
  });

  it('recognizes explicit self-reframe markers for uncued pivots', () => {
    assert.ok(
      markerReframeScore(
        'I thought the chart proved causation. The problem was my old frame. A better reading is that the interval asks what the estimate can support.',
      ) >= 0.8,
    );
  });
});
