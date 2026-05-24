import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  createProgressReporter,
  formatDuration,
  renderProgressBar,
  runTasksWithConcurrency,
} from '../scripts/progress.js';

describe('progress helpers', () => {
  it('renders bounded progress bars', () => {
    assert.equal(renderProgressBar(2, 4, 10), '[#####.....] 2/4 50%');
    assert.equal(renderProgressBar(99, 4, 10), '[##########] 4/4 100%');
  });

  it('formats elapsed duration compactly', () => {
    assert.equal(formatDuration(900), '0s');
    assert.equal(formatDuration(65_000), '1m05s');
    assert.equal(formatDuration(3_665_000), '1h01m05s');
  });

  it('writes start, step, and finish updates to the supplied stream', () => {
    const lines = [];
    const reporter = createProgressReporter({
      label: 'demo',
      total: 2,
      heartbeatMs: 0,
      stream: { write: (line) => lines.push(line.trim()) },
    });

    reporter.start('begin');
    reporter.step('first');
    reporter.finish('done');

    assert.equal(lines.length, 3);
    assert.match(lines[0], /^demo \[........................\] 0\/2 0% elapsed 0s · begin$/);
    assert.match(lines[1], /^demo \[############............\] 1\/2 50% elapsed 0s · first$/);
    assert.match(lines[2], /^demo \[########################\] 2\/2 100% elapsed 0s · done$/);
  });

  it('runs async tasks with bounded concurrency while preserving result order', async () => {
    let active = 0;
    let maxActive = 0;
    const tasks = [0, 1, 2, 3].map((value) => async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, value === 0 ? 20 : 1));
      active -= 1;
      return value;
    });

    const results = await runTasksWithConcurrency(tasks, 2);

    assert.deepEqual(results, [0, 1, 2, 3]);
    assert.equal(maxActive, 2);
  });

  it('stops scheduling new tasks after a failure while awaiting active work', async () => {
    const started = [];
    let active = 0;
    const tasks = [
      async () => {
        started.push(0);
        active += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        active -= 1;
        return 0;
      },
      async () => {
        started.push(1);
        active += 1;
        await new Promise((resolve) => setTimeout(resolve, 1));
        active -= 1;
        throw new Error('boom');
      },
      async () => {
        started.push(2);
        return 2;
      },
    ];

    await assert.rejects(() => runTasksWithConcurrency(tasks, 2), /boom/);

    assert.deepEqual(started, [0, 1]);
    assert.equal(active, 0);
  });
});
