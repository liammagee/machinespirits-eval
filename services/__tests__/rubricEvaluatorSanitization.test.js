import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDialogueQualityPrompt,
  buildEvaluationPrompt,
  buildLearnerDeliberationPrompt,
  buildTutorHolisticEvaluationPrompt,
  quickValidate,
} from '../rubricEvaluator.js';

describe('rubricEvaluator think-block sanitization', () => {
  it('ignores think blocks during rule-based validation', () => {
    const suggestion = {
      title: 'Tutor reply',
      message: '<think>concrete example forbidden phrase</think> Visible response only.',
      reasoning: '<think>concrete example</think>',
    };
    const scenario = {
      requiredElements: ['concrete example'],
      forbiddenElements: ['forbidden phrase'],
    };

    const result = quickValidate(suggestion, scenario);

    assert.equal(result.passesRequired, false);
    assert.equal(result.passesForbidden, true);
    assert.deepEqual(result.requiredMissing, ['concrete example']);
    assert.deepEqual(result.forbiddenFound, []);
  });

  it('strips think blocks from single-turn evaluation prompts', () => {
    const prompt = buildEvaluationPrompt(
      {
        title: 'Draft',
        message: '<think>hidden analysis</think> Visible tutor message.',
      },
      {
        name: 'Test Scenario',
        description: 'desc',
        expectedBehavior: 'help',
        learnerContext: '<think>private learner reasoning</think> learner asks for help',
        requiredElements: [],
        forbiddenElements: [],
      },
      {
        prebuiltTranscript: '[Learner] confused\n[Tutor] <think>internal chain</think> Visible tutor message.',
      },
    );

    assert.ok(prompt.includes('Visible tutor message.'));
    assert.ok(prompt.includes('learner asks for help'));
    assert.ok(!prompt.includes('<think>'));
    assert.ok(!prompt.includes('hidden analysis'));
    assert.ok(!prompt.includes('internal chain'));
    assert.ok(!prompt.includes('private learner reasoning'));
  });

  it('strips think blocks from holistic and dialogue-quality prompts', () => {
    const turns = [
      {
        turnIndex: 0,
        learnerMessage: '<think>hidden learner chain</think> Learner visible message.',
        suggestion: {
          message: '<think>hidden tutor chain</think> Tutor visible response.',
        },
      },
    ];

    const holisticPrompt = buildTutorHolisticEvaluationPrompt({
      turns,
      dialogueTrace: [],
      scenarioName: 'Scenario',
      learnerContext: 'Initial context',
    });
    const dialoguePrompt = buildDialogueQualityPrompt({
      turns,
      dialogueTrace: [],
      scenarioName: 'Scenario',
      transcriptMode: 'public',
      learnerContext: '### Current Session\n- User says hello',
    });

    assert.ok(holisticPrompt.includes('Tutor visible response.'));
    assert.ok(dialoguePrompt.includes('Learner visible message.'));
    assert.ok(!holisticPrompt.includes('<think>'));
    assert.ok(!dialoguePrompt.includes('<think>'));
    assert.ok(!holisticPrompt.includes('hidden tutor chain'));
    assert.ok(!dialoguePrompt.includes('hidden learner chain'));
  });

  it('strips think blocks from deliberation prompts while keeping visible content', () => {
    const prompt = buildLearnerDeliberationPrompt({
      turns: [
        {
          turnIndex: 0,
          learnerMessage: '<think>hidden learner chain</think> Visible learner reply.',
          suggestion: { message: 'Tutor response.' },
        },
      ],
      dialogueTrace: [],
      scenarioName: 'Scenario',
      learnerContext: 'Initial learner context',
    });

    assert.ok(prompt.includes('Visible learner reply.'));
    assert.ok(!prompt.includes('<think>'));
    assert.ok(!prompt.includes('hidden learner chain'));
  });
});
