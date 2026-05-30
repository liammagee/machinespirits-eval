import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  createProgressReporter,
  computeEta,
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

describe('progress ETA + live sub-progress', () => {
  it('computeEta projects remaining time from the completion fraction', () => {
    assert.equal(computeEta(60_000, 0, 4), null); // no basis yet
    assert.equal(computeEta(60_000, 1, 4), 180_000); // 25% in 60s -> 180s remain
    assert.equal(computeEta(60_000, 2, 2), 0); // complete
    assert.equal(computeEta(60_000, 0.5, 4), 420_000); // sub-unit progress counts (12.5%)
    assert.equal(computeEta(1_000, 1, 0), null); // unknown total -> no ETA
  });

  it('update() feeds in-flight sub-progress into microDone; a keyed step clears it', () => {
    const reporter = createProgressReporter({ total: 4, heartbeatMs: 0, enabled: false });
    reporter.update('a', 0.5);
    reporter.update('b', 0.25);
    assert.equal(reporter.snapshot().microDone, 0.75); // 0 done + 0.5 + 0.25 in flight
    reporter.step('a done', 1, 'a'); // a completes; its in-flight fraction is cleared
    assert.equal(reporter.snapshot().microDone, 1.25); // 1 done + 0.25 (b still in flight)
  });

  it('surfaces an ETA in the heartbeat once there is progress, but not on event lines', async () => {
    const lines = [];
    const reporter = createProgressReporter({
      label: 'demo',
      total: 2,
      heartbeatMs: 10,
      stream: { write: (line) => lines.push(line.trim()) },
    });
    reporter.update('x', 0.5); // 0.5/2 = 25% overall -> ETA computable
    reporter.start('begin');
    await new Promise((resolve) => setTimeout(resolve, 45));
    reporter.stop();
    assert.ok(
      lines.some((l) => /ETA ~/.test(l)),
      `expected an ETA heartbeat line, got: ${lines.join(' | ')}`,
    );
    assert.ok(!/ETA ~/.test(lines[0])); // the start (event) line stays ETA-free
  });
});
