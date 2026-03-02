import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { formatApiMessages } from '../apiMessageFormatter.js';

describe('apiMessageFormatter', () => {
  let originalConsoleLog;
  let logOutput = [];

  beforeEach(() => {
    originalConsoleLog = console.log;
    console.log = (...args) => {
      logOutput.push(args.join(' '));
    };
    logOutput = [];
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  it('handles empty or invalid records gracefully', () => {
    formatApiMessages(null);
    formatApiMessages([]);
    assert.equal(logOutput.length, 0);
  });

  it('formats a basic API record with truncated messages', () => {
    const records = [
      {
        provider: 'openrouter',
        durationMs: 1500,
        request: {
          body: {
            model: 'test-model',
            system: 'You are a helpful tutor.',
            messages: [
              { role: 'user', content: 'Hello there, how are you today?'.repeat(20) }
            ]
          }
        },
        response: {
          json: {
            usage: {
              prompt_tokens: 10,
              completion_tokens: 20
            }
          }
        }
      }
    ];

    formatApiMessages(records, { showMessages: false });
    
    const output = logOutput.join('\n');
    assert.match(output, /API Messages \(1 call\)/);
    assert.match(output, /API Call #1: openrouter \(ego\) — test-model/);
    assert.match(output, /system\s*: You are a helpful tutor/);
    assert.match(output, /user\s*: Hello there/);
    assert.match(output, /\.\.\./);
    assert.match(output, /10 in \/ 20 out — 1.5s/);
  });

  it('formats an API record without truncation when full is specified', () => {
    const records = [
      {
        provider: 'anthropic',
        durationMs: 500,
        request: {
          body: {
            model: 'claude-3',
            messages: [
              { role: 'system', content: 'You are a strict superego critic.' },
              { role: 'user', content: [{ type: 'text', text: 'Analyze this.' }] }
            ]
          }
        },
        response: {
          body: {
            usage: {
              input_tokens: 5,
              output_tokens: 15
            }
          }
        }
      }
    ];

    formatApiMessages(records, { showMessages: 'full' });
    
    const output = logOutput.join('\n');
    assert.match(output, /API Call #1: anthropic \(superego\) — claude-3/);
    assert.match(output, /system\s*: You are a strict superego critic./);
    assert.match(output, /user\s*: Analyze this./);
    assert.doesNotMatch(output, /\.\.\./);
    assert.match(output, /5 in \/ 15 out — 0.5s/);
  });

  it('handles missing body, tokens, or duration gracefully', () => {
    const records = [
      {},
      {
        request: {
          body: {
            model: 'unknown-model'
          }
        }
      },
      {
        request: {
          body: {
            system: 'You are a learner ego.',
            messages: [{ role: 'assistant', content: null }]
          }
        }
      }
    ];

    formatApiMessages(records);
    const output = logOutput.join('\n');
    
    assert.match(output, /API Call #3: \? \(learner\) — \?/);
    assert.match(output, /system\s*: You are a learner ego./);
  });

  it('extracts role correctly based on keywords', () => {
    const records = [
      {
        request: {
          body: { system: 'review the following' }
        }
      },
      {
        request: {
          body: { system: 'you are a pedagog' }
        }
      },
      {
        request: {
          body: { system: 'no matching keywords' }
        }
      }
    ];

    formatApiMessages(records);
    const output = logOutput.join('\n');
    
    assert.match(output, /\(superego\)/);
    assert.match(output, /\(ego\)/);
    assert.match(output, /API Call #3: \? — \?/); 
  });
});