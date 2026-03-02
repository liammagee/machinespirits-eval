import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { LiveApiReporter } from '../liveApiReporter.js';
import { setGlobalOnRecord } from '../apiPayloadCapture.js';

describe('LiveApiReporter', () => {
  let reporter;
  let stderrOutput = [];
  let originalStderrWrite;

  beforeEach(() => {
    reporter = new LiveApiReporter();
    
    // Mock stderr
    originalStderrWrite = process.stderr.write;
    process.stderr.write = (chunk) => {
      stderrOutput.push(chunk.toString());
    };
    stderrOutput = [];
    
    // Ensure we start clean
    reporter.uninstall();
  });

  afterEach(() => {
    process.stderr.write = originalStderrWrite;
    reporter.uninstall();
  });

  it('installs and uninstalls globally', () => {
    // Just verify the methods run without throwing. 
    // Testing actual payload capture integration would be an integration test.
    reporter.install();
    assert.doesNotThrow(() => reporter.uninstall());
  });

  it('formats an API record correctly outside of a conversation scope', () => {
    const record = {
      durationMs: 1500,
      request: {
        body: {
          model: 'openrouter/test-model-name-is-very-long-so-it-will-be-truncated',
          system: 'You are a helpful pedagog tutor.',
        }
      },
      response: {
        json: {
          usage: { prompt_tokens: 10, completion_tokens: 20 }
        }
      }
    };

    reporter._onRecord(record);
    
    assert.equal(stderrOutput.length, 1);
    const line = stderrOutput[0];
    assert.match(line, /#  1/);
    assert.match(line, /\?\|\?/); // Unknown profile|scenario
    assert.match(line, /ego/); // Role inferred from 'tutor'
    assert.match(line, /test-model-name-is-ver\.\./); // Truncated model name
    assert.match(line, /1\.5s/); // Duration
    assert.match(line, /10->20/); // Tokens
  });

  it('formats an API record correctly inside a conversation scope', () => {
    const record = {
      durationMs: 500,
      request: {
        body: {
          model: 'claude-3',
          messages: [{ role: 'system', content: 'You are a strict superego critic.' }]
        }
      },
      response: {
        body: {
          usage: { input_tokens: 5, output_tokens: 15 }
        }
      }
    };

    reporter.withConversation({ profileName: 'cell_42_base_multi_psycho', scenarioId: 'frustration_scenario' }, () => {
      reporter.setTurnIdx(3);
      reporter._onRecord(record);
    });
    
    assert.equal(stderrOutput.length, 1);
    const line = stderrOutput[0];
    assert.match(line, /base-multi-psych\|frustration-scen/); // Formatted identifiers
    assert.match(line, /T3/); // Turn index
    assert.match(line, /superego/); // Inferred role
    assert.match(line, /claude-3/);
    assert.match(line, /0\.5s/);
    assert.match(line, /5->15/);
  });

  it('infers learner roles correctly', () => {
    const record = { request: { body: { system: 'You are a learner ego.' } } };
    reporter._onRecord(record);
    assert.match(stderrOutput[0], /learner_ego/);
  });
  
  it('infers reflection roles correctly', () => {
    const record = { request: { body: { system: 'profiling other agent' } } };
    reporter._onRecord(record);
    assert.match(stderrOutput[0], /profile/);
  });
  
  it('infers unknown roles when no keywords match', () => {
    const record = { request: { body: { system: 'just some random text' } } };
    reporter._onRecord(record);
    assert.match(stderrOutput[0], /unknown/);
  });

  it('formats errors correctly', () => {
    const record = {
      error: 'Network timeout',
      request: { body: { model: 'gpt-4' } }
    };
    reporter._onRecord(record);
    assert.match(stderrOutput[0], /ERR/);
  });

  it('handles missing fields gracefully', () => {
    const record = {};
    reporter._onRecord(record);
    
    assert.equal(stderrOutput.length, 1);
    const line = stderrOutput[0];
    assert.match(line, /\?\|\?/);
    assert.match(line, /unknown/);
    assert.match(line, /\?/); // Model is ?
    assert.match(line, /\? s/); // Duration is ?
  });

  it('cycles through lane colors for different conversations', () => {
    // Generate records for different conversations to trigger color caching
    reporter.withConversation({ profileName: 'p1', scenarioId: 's1' }, () => reporter._onRecord({}));
    reporter.withConversation({ profileName: 'p2', scenarioId: 's2' }, () => reporter._onRecord({}));
    reporter.withConversation({ profileName: 'p1', scenarioId: 's1' }, () => reporter._onRecord({}));
    
    assert.equal(stderrOutput.length, 3);
    assert.equal(reporter.colorMap.size, 2);
  });

});