import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { StreamingReporter } from '../services/streamingReporter.js';

describe('StreamingReporter', () => {
  let reporter;
  let logOutput;

  beforeEach(() => {
    logOutput = [];
    mock.method(console, 'log', (...args) => logOutput.push(args.join(' ')));
    reporter = new StreamingReporter({
      totalTests: 10,
      totalScenarios: 2,
      profiles: ['cell_1', 'cell_5'],
      scenarios: ['misconception', 'resistance'],
    });
  });

  describe('onTestComplete', () => {
    it('increments completed count', () => {
      reporter.onTestComplete({ overallScore: 85.5, success: true, profileName: 'cell_1', scenarioId: 's1' });
      assert.equal(reporter.completedCount, 1);
    });

    it('prints progress bar with score', () => {
      reporter.onTestComplete({ overallScore: 85.5, success: true, profileName: 'cell_1', scenarioId: 's1' });
      assert.equal(logOutput.length, 1);
      assert.ok(logOutput[0].includes('85.5'), 'should contain score');
      assert.ok(logOutput[0].includes('1/10'), 'should contain count');
      assert.ok(logOutput[0].includes('ETA'), 'should contain ETA');
    });

    it('handles null score', () => {
      reporter.onTestComplete({ overallScore: null, success: true });
      assert.ok(logOutput[0].includes('--'), 'should show -- for null score');
    });
  });

  describe('onTestError', () => {
    it('increments completed count', () => {
      reporter.onTestError({ errorMessage: 'timeout', profileName: 'cell_1', scenarioName: 's1' });
      assert.equal(reporter.completedCount, 1);
    });

    it('prints error indicator', () => {
      reporter.onTestError({ errorMessage: 'API timeout', profileName: 'cell_1', scenarioName: 's1' });
      assert.ok(logOutput[0].includes('ERROR'), 'should contain ERROR');
    });

    it('truncates long error messages', () => {
      const longMsg = 'x'.repeat(100);
      reporter.onTestError({ errorMessage: longMsg });
      // Error is sliced to 60 chars
      assert.ok(logOutput[0].length < 200, 'should not contain full 100-char error');
    });
  });

  describe('onScenarioComplete', () => {
    it('prints scenario summary with avg score', () => {
      reporter.onScenarioComplete({
        scenarioName: 'misconception',
        avgScore: 87.3,
        completedScenarios: 1,
        totalScenarios: 2,
      });
      assert.equal(logOutput.length, 3); // separator + summary + separator
      assert.ok(logOutput[1].includes('87.3'), 'should contain avg score');
      assert.ok(logOutput[1].includes('misconception'), 'should contain scenario name');
    });
  });

  describe('onRunComplete', () => {
    it('prints run summary', () => {
      reporter.onRunComplete({ totalTests: 10, successfulTests: 9, failedTests: 1, durationMs: 65000 });
      assert.ok(logOutput.some((l) => l.includes('EVALUATION COMPLETE')));
      assert.ok(logOutput.some((l) => l.includes('9 passed')));
      assert.ok(logOutput.some((l) => l.includes('1 failed')));
    });
  });
});
