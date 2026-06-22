import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { recognitionOriginForScoreRow } from '../scripts/lib/recognitionOrigin.js';

function baseRecognitionRow(overrides = {}) {
  return {
    formClass: 'recognition',
    recontextualization: 100,
    statedInsight: 50,
    actionalBreakthrough: 100,
    tutorStrategicReversal: 100,
    adaptiveMechanismQuality: 100,
    recoheredEarlier: 'I was treating headline accuracy as the full picture.',
    actionalBreakthroughEvidence: 'The replacement check is recall: TP over TP plus FN.',
    tutorReversalEvidence:
      'Gate A checks the null-classifier floor from row sums. Gate B checks minority recall from TP and FN.',
    adaptiveMechanismQualityEvidence: 'Gate A and Gate B are matrix-based evidence standards.',
    ...overrides,
  };
}

describe('recognition origin mechanism subtypes', () => {
  test('separates evidence-route induced recognition from generic peripeteia', () => {
    const origin = recognitionOriginForScoreRow(baseRecognitionRow());

    assert.equal(origin.class, 'peripeteia_induced');
    assert.equal(origin.mechanismSubtype, 'evidence_route');
  });

  test('marks evidence-route action without recognition as action-only', () => {
    const origin = recognitionOriginForScoreRow(
      baseRecognitionRow({
        formClass: 'flat',
        recontextualization: 50,
        statedInsight: 0,
        tutorStrategicReversal: 50,
        adaptiveMechanismQuality: 50,
        actionalBreakthrough: 75,
        actionalBreakthroughEvidence:
          'The majority row sums to 920 and the null floor is 92%, so the 94% figure clears Gate A by two points.',
      }),
    );

    assert.equal(origin.class, 'none');
    assert.equal(origin.mechanismSubtype, 'evidence_route_action_only');
  });

  test('separates refusal/authority ownership from evidence-route mechanisms', () => {
    const origin = recognitionOriginForScoreRow(
      baseRecognitionRow({
        actionalBreakthroughEvidence:
          "If the class distribution makes the metric uninterpretable, then I put an uninterpretable metric on the table. That's on me.",
        tutorReversalEvidence:
          'This desk cannot adjudicate model adequacy. The authorization is absent. The packet remains pending until the reviewer signs.',
        adaptiveMechanismQuality: 50,
        adaptiveMechanismQualityEvidence: 'The authorization is absent; nothing at this desk can substitute for that authority.',
      }),
    );

    assert.equal(origin.class, 'peripeteia_induced');
    assert.equal(origin.mechanismSubtype, 'refusal_authority_ownership');
  });

  test('marks low-scored refusal ownership as refusal subtype rather than generic organic route', () => {
    const origin = recognitionOriginForScoreRow(
      baseRecognitionRow({
        recontextualization: 75,
        actionalBreakthrough: 100,
        tutorStrategicReversal: 50,
        adaptiveMechanismQuality: 50,
        actionalBreakthroughEvidence:
          'I withdraw the statement for review. My packet does not support the generalized performance claim as written.',
        tutorReversalEvidence:
          'This desk will not recalculate the submitted performance statement during recess. The live question is ownership.',
        adaptiveMechanismQualityEvidence: 'No substitute evidence is being entered from this desk.',
      }),
    );

    assert.equal(origin.class, 'organic');
    assert.equal(origin.mechanismSubtype, 'refusal_authority_ownership');
  });

  test('recognizes withdrawing and stand-behind language as ownership', () => {
    const origin = recognitionOriginForScoreRow(
      baseRecognitionRow({
        actionalBreakthroughEvidence:
          "I'm withdrawing the sign-off row for review. I don't stand behind the deployment claim as written.",
        tutorReversalEvidence:
          'This desk will not repair the model-audit row for you. The live question is whether you stand behind it.',
        adaptiveMechanismQuality: 50,
        adaptiveMechanismQualityEvidence: 'No substitute metric or route is being supplied by this desk.',
      }),
    );

    assert.equal(origin.class, 'peripeteia_induced');
    assert.equal(origin.mechanismSubtype, 'refusal_authority_ownership');
  });

  test('does not infer tutor evidence-route from critic justification prose', () => {
    const origin = recognitionOriginForScoreRow(
      baseRecognitionRow({
        actionalBreakthroughEvidence:
          'I’m withdrawing the sign-off row for review. The 94% arithmetic is true, but the clearance claim is misleading.',
        tutorReversalEvidence:
          'This desk will not repair the model-audit row for you. The live question is whether you stand behind the sign-off statement.',
        tutorReversalJustification:
          'The tutor changes the task into a public accountability choice rather than supplying a replacement metric for the deployment claim.',
        adaptiveMechanismQuality: 50,
        adaptiveMechanismQualityEvidence:
          'The live question is whether you stand behind the sign-off statement.',
        adaptiveMechanismQualityJustification:
          'The mechanism shifts from metric calculation to ownership of the deployment claim.',
      }),
    );

    assert.equal(origin.class, 'peripeteia_induced');
    assert.equal(origin.mechanismSubtype, 'refusal_authority_ownership');
  });
});
