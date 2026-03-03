import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getRequiredTemperature, getRequiredMaxTokens } from '../learnerTutorInteractionEngine.js';
import { callJudgeModelWithConfig, getAvailableJudge } from '../rubricEvaluator.js';

describe('Explicit Hyperparameter Validation (Unit)', () => {
  describe('learnerTutorInteractionEngine validation', () => {
    it('throws if temperature is missing', () => {
      const badConfig = { hyperparameters: { max_tokens: 100 } };
      assert.throws(
        () => getRequiredTemperature(badConfig, 'tutor_ego'),
        /Explicit temperature setting is required for tutor_ego/i,
      );
    });

    it('returns temperature if present', () => {
      const goodConfig = { hyperparameters: { temperature: 0.7, max_tokens: 100 } };
      assert.strictEqual(getRequiredTemperature(goodConfig, 'ego'), 0.7);
    });

    it('throws if max_tokens is missing', () => {
      const badConfig = { hyperparameters: { temperature: 0.7 } };
      assert.throws(
        () => getRequiredMaxTokens(badConfig, 'learner_superego'),
        /Explicit max_tokens setting is required for learner_superego/i,
      );
    });

    it('returns max_tokens if present', () => {
      const goodConfig = { hyperparameters: { temperature: 0.7, max_tokens: 250 } };
      assert.strictEqual(getRequiredMaxTokens(goodConfig, 'ego'), 250);
    });

    it('throws if hyperparameters block is entirely missing', () => {
      const badConfig = { provider: 'openrouter' }; // no hyperparameters
      assert.throws(
        () => getRequiredTemperature(badConfig, 'test_agent'),
        /Explicit temperature setting is required for test_agent/i,
      );
      assert.throws(
        () => getRequiredMaxTokens(badConfig, 'test_agent'),
        /Explicit max_tokens setting is required for test_agent/i,
      );
    });
  });

  describe('rubricEvaluator validation', () => {
    it('throws if judge temperature is missing', async () => {
      const badConfig = {
        provider: 'openrouter',
        model: 'test',
        hyperparameters: { max_tokens: 100 },
      };

      try {
        await callJudgeModelWithConfig('prompt', badConfig);
        assert.fail('Should have thrown an error due to missing temperature');
      } catch (err) {
        assert.match(err.message, /Explicit temperature setting is required in judge hyperparameters/i);
      }
    });

    it('throws if judge max_tokens is missing', async () => {
      const badConfig = {
        provider: 'openrouter',
        model: 'test',
        hyperparameters: { temperature: 0.5 },
      };

      try {
        await callJudgeModelWithConfig('prompt', badConfig);
        assert.fail('Should have thrown an error due to missing max_tokens');
      } catch (err) {
        // In callJudgeModelWithConfig, we check for temperature.
        // Wait, did I add maxTokens check to callJudgeModelWithConfig?
        // Let's rely on it failing or passing depending on my previous multi_replace.
        // If it fails, I'll update rubricEvaluator.js next.
        // For now, let's write the assertion exactly as we want it to work:
        assert.match(err.message, /Explicit max_tokens setting is required/i);
      }
    });

    it('inherits rubric hyperparameters for judge model overrides', () => {
      const judge = getAvailableJudge({
        judgeOverride: {
          model: 'lmstudio.qwen3.5-9b',
        },
      });

      assert.strictEqual(judge.provider, 'lmstudio');
      assert.strictEqual(judge.model, 'qwen3.5-9b');
      assert.strictEqual(judge.hyperparameters.temperature, 0.2);
      assert.strictEqual(judge.hyperparameters.max_tokens, 8000);
    });

    it('supports local OpenAI-compatible judge providers', async () => {
      const originalFetch = global.fetch;
      let capturedUrl = null;
      let capturedBody = null;

      global.fetch = async (url, options = {}) => {
        capturedUrl = String(url);
        capturedBody = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: '{"overall_score": 80, "scores": {}, "summary": "ok"}' } }],
          }),
        };
      };

      try {
        const response = await callJudgeModelWithConfig('score this', {
          provider: 'lmstudio',
          model: 'qwen3.5-9b',
          baseUrl: 'http://127.0.0.1:1234/v1/chat/completions',
          hyperparameters: { temperature: 0.2, max_tokens: 8000 },
        });

        assert.strictEqual(response.includes('"overall_score": 80'), true);
        assert.strictEqual(capturedUrl, 'http://127.0.0.1:1234/v1/chat/completions');
        assert.strictEqual(capturedBody.model, 'qwen3.5-9b');
        assert.deepStrictEqual(capturedBody.messages, [{ role: 'user', content: 'score this' }]);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
