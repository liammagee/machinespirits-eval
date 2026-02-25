import { strict as assert } from 'assert';
import { describe, it } from 'node:test';
import { buildMessageChain, buildProjectionDiagnostics, projectTranscriptArtifacts, traceToSteps } from '../services/transcriptProjection.js';

const sampleTrace = [
  {
    agent: 'user',
    action: 'context_input',
    rawContext: '### Recent Chat History\n- User: "I am stuck on this concept."',
  },
  {
    agent: 'ego',
    action: 'generate',
    metrics: { model: 'nvidia/nemotron-3-nano-30b-a3b:free', latencyMs: 1200 },
    suggestions: [{ message: 'Let us unpack your confusion step-by-step.' }],
    apiPayload: {
      request: {
        body: {
          model: 'nvidia/nemotron-3-nano-30b-a3b:free',
          messages: [
            { role: 'system', content: 'System prompt text' },
            { role: 'user', content: 'User prompt text' },
          ],
        },
      },
      response: {
        body: {
          choices: [{ message: { content: 'Assistant response text' } }],
        },
      },
    },
  },
  {
    agent: 'superego',
    action: 'review',
    approved: true,
    feedback: 'Approved with minor wording change.',
  },
  {
    agent: 'user',
    action: 'turn_action',
    turnIndex: 1,
    contextSummary: 'Can we go slower and define negation of negation?',
  },
];

describe('transcriptProjection', () => {
  it('builds message-chain exchanges with semantic and raw content', () => {
    const chain = buildMessageChain(sampleTrace);
    assert.equal(chain.exchanges.length, 2);

    const egoExchange = chain.exchanges.find((e) => e.agent === 'ego');
    assert.ok(egoExchange, 'Expected ego exchange');
    assert.equal(egoExchange.raw.systemPrompt, 'System prompt text');
    assert.equal(egoExchange.raw.userRequest, 'User prompt text');
    assert.equal(egoExchange.raw.assistantResponse, 'Assistant response text');
    assert.equal(egoExchange.semantic.assistantResponse, 'Let us unpack your confusion step-by-step.');
  });

  it('projects steps from trace for transcript/diagram rendering', () => {
    const steps = traceToSteps(sampleTrace);
    assert.ok(steps.length >= 2);
    assert.ok(steps.some((s) => s.label === 'Initial query'));
    assert.ok(steps.some((s) => s.label === 'Approved ✓'));
  });

  it('reports diagnostics when payloads or turn indices are missing', () => {
    const chain = buildMessageChain(sampleTrace);
    const steps = traceToSteps(sampleTrace);
    const diagnostics = buildProjectionDiagnostics({
      trace: sampleTrace,
      steps,
      messageChain: chain,
    });
    assert.ok(diagnostics.effectCount >= 1);
    assert.ok(diagnostics.effects.some((e) => e.id === 'missing_turn_index'));
  });

  it('returns unified projection artifacts', () => {
    const projection = projectTranscriptArtifacts({
      trace: sampleTrace,
      turnResults: [{ suggestion: { message: 'Tutor turn 1' }, learnerMessage: 'Learner turn 1' }],
      learnerContext: '### Recent Chat History\n- User: "I am stuck on this concept."',
      scenarioName: 'Demo scenario',
      profileName: 'cell_demo',
      totalTurns: 1,
      detail: 'play',
    });

    assert.ok(Array.isArray(projection.steps));
    assert.ok(Array.isArray(projection.messageChain.exchanges));
    assert.ok(typeof projection.formatted === 'string');
    assert.ok(typeof projection.judged.publicTranscript === 'string');
    assert.ok(typeof projection.judged.fullTranscript === 'string');
    assert.ok(projection.diagnostics && typeof projection.diagnostics.effectCount === 'number');
  });
});

