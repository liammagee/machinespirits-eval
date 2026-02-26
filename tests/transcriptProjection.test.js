import { strict as assert } from 'assert';
import { describe, it } from 'node:test';
import { buildMessageChain, buildProjectionDiagnostics, projectTranscriptArtifacts, traceToSteps } from '../services/transcriptProjection.js';

const sampleTrace = [
  {
    agent: 'tutor',
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
    agent: 'learner',
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

  // ---- Single-agent cell: ego generates with NO superego review following ----

  it('single-agent trace: ego generate routes to learner, not superego', () => {
    // Trace for a single-agent cell (no superego entries at all)
    const singleAgentTrace = [
      {
        agent: 'tutor',
        action: 'context_input',
        rawContext: '### Recent Chat History\n- User: "Help me understand recognition."',
      },
      {
        agent: 'ego',
        action: 'generate',
        metrics: { model: 'nvidia/nemotron-3-nano-30b-a3b:free', latencyMs: 1500 },
        suggestions: [{ message: 'Let me explain the master-servant dialectic.' }],
      },
    ];
    const steps = traceToSteps(singleAgentTrace);
    const egoStep = steps.find((s) => s.speaker === 'TUTOR EGO');
    assert.ok(egoStep, 'Expected a tutor ego step');
    assert.equal(egoStep.from, 'tutor_ego');
    assert.equal(egoStep.to, 'learner_ego', 'Single-agent ego generate should route to learner, not superego');
    assert.equal(egoStep.type, 'response', 'Should be a response, not a back/draft');
    assert.equal(egoStep.label, 'Response');
    // Must NOT have any steps going to tutor_superego
    const superegoSteps = steps.filter((s) => s.to === 'tutor_superego');
    assert.equal(superegoSteps.length, 0, 'No steps should route to tutor_superego for single-agent traces');
  });

  it('multi-turn single-agent trace: all ego generates route to learner', () => {
    // Multi-turn: 2 turns, no superego review
    const multiTurnTrace = [
      { agent: 'tutor', action: 'context_input', rawContext: '### Recent Chat History\n- User: "Stuck on dialectics."' },
      { agent: 'ego', action: 'generate', metrics: { latencyMs: 1200 }, suggestions: [{ message: 'Turn 1 response' }] },
      { agent: 'tutor', action: 'context_input', rawContext: '### Recent Chat History\n- User: "Can you clarify?"' },
      { agent: 'ego', action: 'generate', metrics: { latencyMs: 800 }, suggestions: [{ message: 'Turn 2 response' }] },
    ];
    const steps = traceToSteps(multiTurnTrace);
    const superegoSteps = steps.filter((s) => s.to === 'tutor_superego');
    assert.equal(superegoSteps.length, 0, 'No steps should route to tutor_superego');
    const responseSteps = steps.filter((s) => s.from === 'tutor_ego' && s.to === 'learner_ego');
    assert.equal(responseSteps.length, 2, 'Both ego generates should be responses to learner');
  });

  it('multi-agent trace: ego generate routes to superego when review follows', () => {
    // Verify the existing behavior is preserved for multi-agent traces
    const steps = traceToSteps(sampleTrace);
    const draftStep = steps.find((s) => s.label === 'Draft');
    assert.ok(draftStep, 'Expected a Draft step for multi-agent trace');
    assert.equal(draftStep.to, 'tutor_superego', 'Draft should route to superego when review follows');
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

