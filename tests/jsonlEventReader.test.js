import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { readSelectedJsonlEventsSync } from '../services/jsonlEventReader.js';

test('JSONL event reader discards large unselected payloads while retaining summary and error events', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jsonl-selected-events-'));
  const tracePath = path.join(directory, 'trace.jsonl');
  try {
    fs.writeFileSync(
      tracePath,
      [
        JSON.stringify({ seq: 1, type: 'model_call', response: 'x'.repeat(5 * 1024 * 1024) }),
        JSON.stringify({ seq: 2, type: 'turn_complete', turn: 1, turnRecord: { tutor: 'bounded' } }),
        JSON.stringify({ seq: 3, type: 'model_call_error', error: 'failed safely' }),
      ].join('\n'),
    );
    const scan = readSelectedJsonlEventsSync(tracePath, {
      retainTypes: ['turn_complete'],
      retainErrorTypes: true,
      chunkBytes: 1024,
    });
    assert.equal(scan.eventCount, 3);
    assert.equal(scan.lastType, 'model_call_error');
    assert.equal(scan.parseErrorCount, 0);
    assert.deepEqual(
      scan.events.map((event) => event.type),
      ['turn_complete', 'model_call_error'],
    );
    assert.equal(scan.events[0].turnRecord.tutor, 'bounded');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
