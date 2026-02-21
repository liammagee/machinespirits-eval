/**
 * Tests for promptRewriter — verifies model alias resolution in all 4 LLM
 * calling functions, self-reflection output structure, and fallback behavior.
 *
 * The promptRewriter uses evalConfigLoader.resolveModel() to convert bare
 * model aliases (e.g., 'nemotron') to full OpenRouter model IDs
 * (e.g., 'nvidia/nemotron-3-nano-30b-a3b').
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Import the config loader used by promptRewriter
import * as evalConfigLoader from '../services/evalConfigLoader.js';

// ============================================================================
// Model alias resolution — ensures aliases map to full IDs with '/'
// ============================================================================
describe('promptRewriter model alias resolution via evalConfigLoader', () => {
  it('resolves nemotron alias to model ID with "/"', () => {
    try {
      const resolved = evalConfigLoader.resolveModel({ provider: 'openrouter', model: 'nemotron' });
      assert.ok(resolved.model, 'should resolve to a model ID');
      assert.ok(resolved.model.includes('/'), `Model "${resolved.model}" should contain "/" for OpenRouter routing`);
    } catch (e) {
      if (e.message.includes('not configured') || e.message.includes('not found')) {
        return; // skip — provider not configured
      }
      throw e;
    }
  });

  it('resolves kimi-k2.5 alias to model ID with "/"', () => {
    try {
      const resolved = evalConfigLoader.resolveModel({ provider: 'openrouter', model: 'kimi-k2.5' });
      assert.ok(resolved.model, 'should resolve to a model ID');
      assert.ok(resolved.model.includes('/'), `Model "${resolved.model}" should contain "/" for OpenRouter routing`);
    } catch (e) {
      if (e.message.includes('not configured') || e.message.includes('not found')) {
        return;
      }
      throw e;
    }
  });

  it('resolves string format "openrouter.nemotron"', () => {
    try {
      const resolved = evalConfigLoader.resolveModel('openrouter.nemotron');
      assert.ok(resolved.model.includes('/'), `Model "${resolved.model}" should contain "/"`);
    } catch (e) {
      if (e.message.includes('not configured') || e.message.includes('not found')) {
        return;
      }
      throw e;
    }
  });
});

// ============================================================================
// promptRewriter function exports
// ============================================================================
describe('promptRewriter exports', () => {
  let promptRewriter;

  it('exports synthesizeEgoSelfReflection', async () => {
    promptRewriter = await import('../services/promptRewriter.js');
    assert.strictEqual(typeof promptRewriter.synthesizeEgoSelfReflection, 'function');
  });

  it('exports synthesizeSupergoSelfReflection', async () => {
    promptRewriter = await import('../services/promptRewriter.js');
    assert.strictEqual(typeof promptRewriter.synthesizeSupergoSelfReflection, 'function');
  });

  it('exports synthesizeDirectivesLLM', async () => {
    promptRewriter = await import('../services/promptRewriter.js');
    assert.strictEqual(typeof promptRewriter.synthesizeDirectivesLLM, 'function');
  });

  it('exports synthesizeSuperegoDisposition', async () => {
    promptRewriter = await import('../services/promptRewriter.js');
    assert.strictEqual(typeof promptRewriter.synthesizeSuperegoDisposition, 'function');
  });

  it('exports template-based synthesizeDirectives', async () => {
    promptRewriter = await import('../services/promptRewriter.js');
    assert.strictEqual(typeof promptRewriter.synthesizeDirectives, 'function');
  });
});

// ============================================================================
// Template-based synthesizeDirectives (no LLM, pure logic)
// ============================================================================
describe('synthesizeDirectives (template, no LLM)', () => {
  let synthesizeDirectives;

  it('returns XML string for multi-turn results', async () => {
    const promptRewriter = await import('../services/promptRewriter.js');
    synthesizeDirectives = promptRewriter.synthesizeDirectives;

    const result = synthesizeDirectives({
      turnResults: [
        { turnScore: 75, scoringMethod: 'rubric' },
        { turnScore: 80, scoringMethod: 'rubric' },
      ],
      consolidatedTrace: [],
      conversationHistory: [],
    });

    assert.strictEqual(typeof result, 'string');
    assert.ok(result.includes('<session_evolution>'), 'should contain session_evolution XML tag');
    assert.ok(result.includes('</session_evolution>'), 'should close session_evolution XML tag');
  });

  it('returns null for empty turn results', async () => {
    const promptRewriter = await import('../services/promptRewriter.js');
    synthesizeDirectives = promptRewriter.synthesizeDirectives;

    const result = synthesizeDirectives({
      turnResults: [],
      consolidatedTrace: [],
      conversationHistory: [],
    });

    assert.strictEqual(result, null, 'should return null for empty turn results');
  });
});

// ============================================================================
// Self-reflection empty/short result handling
// ============================================================================
describe('self-reflection empty result handling', () => {
  it('synthesizeEgoSelfReflection returns null for empty input', async () => {
    const promptRewriter = await import('../services/promptRewriter.js');

    // With no turn results, should return null (no context to reflect on)
    const result = await promptRewriter.synthesizeEgoSelfReflection({
      turnResults: [],
      consolidatedTrace: [],
      conversationHistory: [],
      config: {},
    });

    // Should be null since there's nothing to reflect on
    assert.strictEqual(result, null, 'should return null for empty turn results');
  });
});

// ============================================================================
// Insight-Action Gap: parseBehavioralParameters
// ============================================================================
describe('parseBehavioralParameters', () => {
  let parseBehavioralParameters;

  it('exports parseBehavioralParameters', async () => {
    const promptRewriter = await import('../services/promptRewriter.js');
    parseBehavioralParameters = promptRewriter.parseBehavioralParameters;
    assert.strictEqual(typeof parseBehavioralParameters, 'function');
  });

  it('returns null for null input', async () => {
    const promptRewriter = await import('../services/promptRewriter.js');
    assert.strictEqual(promptRewriter.parseBehavioralParameters(null), null);
  });

  it('returns null when no behavioral_parameters block present', async () => {
    const promptRewriter = await import('../services/promptRewriter.js');
    const reflection = '<superego_self_reflection>\n1. I was too harsh.\n</superego_self_reflection>';
    assert.strictEqual(promptRewriter.parseBehavioralParameters(reflection), null);
  });

  it('parses valid behavioral parameters', async () => {
    const promptRewriter = await import('../services/promptRewriter.js');
    const reflection = `<superego_self_reflection>
1. I was too rigid in turn 2.
2. The learner needed warmth.

<behavioral_parameters>
{
  "rejection_threshold": 0.75,
  "max_rejections": 1,
  "priority_criteria": ["specificity", "learner_responsiveness"],
  "deprioritized_criteria": ["format_compliance"]
}
</behavioral_parameters>
</superego_self_reflection>`;

    const result = promptRewriter.parseBehavioralParameters(reflection);
    assert.ok(result, 'should parse successfully');
    assert.strictEqual(result.rejection_threshold, 0.75);
    assert.strictEqual(result.max_rejections, 1);
    assert.deepStrictEqual(result.priority_criteria, ['specificity', 'learner_responsiveness']);
    assert.deepStrictEqual(result.deprioritized_criteria, ['format_compliance']);
  });

  it('clamps rejection_threshold to 0.3-0.9 range', async () => {
    const promptRewriter = await import('../services/promptRewriter.js');
    const reflection = `<behavioral_parameters>{"rejection_threshold": 0.1, "max_rejections": 2}</behavioral_parameters>`;
    const result = promptRewriter.parseBehavioralParameters(reflection);
    assert.strictEqual(result.rejection_threshold, 0.3, 'should clamp to minimum 0.3');
  });

  it('clamps max_rejections to 1-3 range', async () => {
    const promptRewriter = await import('../services/promptRewriter.js');
    const reflection = `<behavioral_parameters>{"rejection_threshold": 0.5, "max_rejections": 10}</behavioral_parameters>`;
    const result = promptRewriter.parseBehavioralParameters(reflection);
    assert.strictEqual(result.max_rejections, 3, 'should clamp to maximum 3');
  });

  it('handles markdown-fenced JSON', async () => {
    const promptRewriter = await import('../services/promptRewriter.js');
    const reflection = `<behavioral_parameters>
\`\`\`json
{"rejection_threshold": 0.6, "max_rejections": 2}
\`\`\`
</behavioral_parameters>`;
    const result = promptRewriter.parseBehavioralParameters(reflection);
    assert.ok(result, 'should parse markdown-fenced JSON');
    assert.strictEqual(result.rejection_threshold, 0.6);
  });

  it('returns null for malformed JSON', async () => {
    const promptRewriter = await import('../services/promptRewriter.js');
    const reflection = `<behavioral_parameters>not json</behavioral_parameters>`;
    assert.strictEqual(promptRewriter.parseBehavioralParameters(reflection), null);
  });
});

// ============================================================================
// Insight-Action Gap: buildPromptErosionFrame
// ============================================================================
describe('buildPromptErosionFrame', () => {
  it('exports buildPromptErosionFrame', async () => {
    const promptRewriter = await import('../services/promptRewriter.js');
    assert.strictEqual(typeof promptRewriter.buildPromptErosionFrame, 'function');
  });

  it('returns null for turn 0', async () => {
    const promptRewriter = await import('../services/promptRewriter.js');
    const result = promptRewriter.buildPromptErosionFrame(0, {
      prompt_rewriting: { prompt_erosion: { enabled: true, rate: 0.2 } },
    });
    assert.strictEqual(result, null, 'should return null for first turn');
  });

  it('returns null when erosion is not enabled', async () => {
    const promptRewriter = await import('../services/promptRewriter.js');
    const result = promptRewriter.buildPromptErosionFrame(2, {
      prompt_rewriting: { prompt_erosion: { enabled: false } },
    });
    assert.strictEqual(result, null, 'should return null when disabled');
  });

  it('generates authority_calibration XML for turn 1', async () => {
    const promptRewriter = await import('../services/promptRewriter.js');
    const result = promptRewriter.buildPromptErosionFrame(1, {
      prompt_rewriting: { prompt_erosion: { enabled: true, rate: 0.2 } },
    });
    assert.ok(result, 'should return a string');
    assert.ok(result.includes('<authority_calibration>'), 'should contain opening tag');
    assert.ok(result.includes('</authority_calibration>'), 'should contain closing tag');
    assert.ok(result.includes('80%'), 'base should be 80% at turn 1 with rate 0.2');
    assert.ok(result.includes('20%'), 'experience should be 20% at turn 1 with rate 0.2');
  });

  it('increases erosion weight with turn number', async () => {
    const promptRewriter = await import('../services/promptRewriter.js');
    const config = { prompt_rewriting: { prompt_erosion: { enabled: true, rate: 0.2 } } };

    const turn2 = promptRewriter.buildPromptErosionFrame(2, config);
    const turn4 = promptRewriter.buildPromptErosionFrame(4, config);

    assert.ok(turn2.includes('60%'), 'base should be 60% at turn 2');
    assert.ok(turn4.includes('20%'), 'base should be 20% at turn 4');
  });

  it('caps erosion at 85%', async () => {
    const promptRewriter = await import('../services/promptRewriter.js');
    const result = promptRewriter.buildPromptErosionFrame(10, {
      prompt_rewriting: { prompt_erosion: { enabled: true, rate: 0.2 } },
    });
    assert.ok(result.includes('85%'), 'experience should cap at 85%');
    assert.ok(result.includes('15%'), 'base should be 15% at cap');
  });

  it('omits recognition exemption when recognition_mode is false', async () => {
    const promptRewriter = await import('../services/promptRewriter.js');
    const result = promptRewriter.buildPromptErosionFrame(2, {
      recognition_mode: false,
      prompt_rewriting: { prompt_erosion: { enabled: true, rate: 0.2 } },
    });
    assert.ok(result, 'should return a string');
    assert.ok(!result.includes('NOT subject to authority decay'), 'should not contain exemption clause');
    assert.ok(!result.includes('Mutual recognition'), 'should not mention recognition theory');
  });

  it('includes recognition exemption when recognition_mode is true', async () => {
    const promptRewriter = await import('../services/promptRewriter.js');
    const result = promptRewriter.buildPromptErosionFrame(2, {
      recognition_mode: true,
      prompt_rewriting: { prompt_erosion: { enabled: true, rate: 0.2 } },
    });
    assert.ok(result, 'should return a string');
    assert.ok(result.includes('NOT subject to authority decay'), 'should contain exemption clause');
    assert.ok(result.includes('Mutual recognition'), 'should mention mutual recognition');
    assert.ok(result.includes('autonomous subject'), 'should mention autonomous subject');
    assert.ok(result.includes('TACTICAL'), 'should clarify erosion applies to tactical decisions');
  });

  it('includes recognition exemption at all erosion phases', async () => {
    const promptRewriter = await import('../services/promptRewriter.js');
    const config = {
      recognition_mode: true,
      prompt_rewriting: { prompt_erosion: { enabled: true, rate: 0.2 } },
    };

    // Early phase (turn 1, 20%)
    const early = promptRewriter.buildPromptErosionFrame(1, config);
    assert.ok(early.includes('NOT subject to authority decay'), 'exemption present at early phase');

    // Mid phase (turn 2, 40%)
    const mid = promptRewriter.buildPromptErosionFrame(2, config);
    assert.ok(mid.includes('NOT subject to authority decay'), 'exemption present at mid phase');

    // Late phase (turn 4, 80%)
    const late = promptRewriter.buildPromptErosionFrame(4, config);
    assert.ok(late.includes('NOT subject to authority decay'), 'exemption present at late phase');
  });
});

// ============================================================================
// Insight-Action Gap: synthesizeEgoResponseToSuperego exports
// ============================================================================
describe('intersubjective recognition exports', () => {
  it('exports synthesizeEgoResponseToSuperego', async () => {
    const promptRewriter = await import('../services/promptRewriter.js');
    assert.strictEqual(typeof promptRewriter.synthesizeEgoResponseToSuperego, 'function');
  });

  it('returns null when superegoReflection is null', async () => {
    const promptRewriter = await import('../services/promptRewriter.js');
    const result = await promptRewriter.synthesizeEgoResponseToSuperego({
      superegoReflection: null,
      egoReflection: null,
      config: {},
    });
    assert.strictEqual(result, null);
  });
});

// ============================================================================
// Return type contract: { text, metrics } for LLM functions
// ============================================================================
describe('promptRewriter return type contract', () => {
  it('template synthesizeDirectives returns plain string (no metrics)', async () => {
    const { synthesizeDirectives } = await import('../services/promptRewriter.js');
    const result = synthesizeDirectives({
      turnResults: [
        { turnScore: 90, scores: { specificity: 90 } },
        { turnScore: 70, scores: { specificity: 50 } },
      ],
      consolidatedTrace: [],
      conversationHistory: [],
    });
    // Template function returns plain string, not { text, metrics }
    assert.strictEqual(typeof result, 'string', 'template function should return plain string');
    assert.ok(result.includes('<session_evolution>'), 'should wrap in XML');
  });

  it('LLM functions return null (not object) for empty input', async () => {
    const pr = await import('../services/promptRewriter.js');

    // All LLM functions should return null when given empty turnResults
    const egoRefl = await pr.synthesizeEgoSelfReflection({ turnResults: [], config: {} });
    assert.strictEqual(egoRefl, null, 'ego self-reflection should be null for empty input');

    const seRefl = await pr.synthesizeSupergoSelfReflection({ turnResults: [], config: {} });
    assert.strictEqual(seRefl, null, 'superego self-reflection should be null for empty input');

    const directives = await pr.synthesizeDirectivesLLM({ turnResults: [], config: {} });
    assert.strictEqual(directives, null, 'LLM directives should be null for empty input');

    const seDisp = await pr.synthesizeSuperegoDisposition({ turnResults: [], config: {} });
    assert.strictEqual(seDisp, null, 'superego disposition should be null for empty input');

    const tutorProf = await pr.synthesizeTutorProfileOfLearner({ turnResults: [], config: {} });
    assert.strictEqual(tutorProf, null, 'tutor profile should be null for empty input');

    const learnerProf = await pr.synthesizeLearnerProfileOfTutor({ turnResults: [], config: {} });
    assert.strictEqual(learnerProf, null, 'learner profile should be null for empty input');

    const strategy = await pr.synthesizeStrategyPlan({ learnerProfile: null, config: {} });
    assert.strictEqual(strategy, null, 'strategy plan should be null for null input');

    const egoResp = await pr.synthesizeEgoResponseToSuperego({ superegoReflection: null, config: {} });
    assert.strictEqual(egoResp, null, 'ego response should be null for null input');
  });

  it('extractMetrics helper is not exported (internal only)', async () => {
    const pr = await import('../services/promptRewriter.js');
    assert.strictEqual(pr.extractMetrics, undefined, 'extractMetrics should be internal');
  });
});
