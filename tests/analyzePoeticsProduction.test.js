import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { buildSummary, renderControlTable } from '../scripts/analyze-poetics-production-v1.js';

function writeScore(root, filename, { critic, formClass }) {
  const dir = path.join(root, 'scores');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, filename),
    JSON.stringify(
      {
        critic,
        formCounts: {
          recognition: formClass === 'recognition' ? 1 : 0,
          trap: formClass === 'trap' ? 1 : 0,
          flat: formClass === 'flat' ? 1 : 0,
        },
        scored: [{ id: 'T01', formClass }],
      },
      null,
      2,
    ),
  );
}

describe('analyze-poetics-production-v1', () => {
  it('reports Sonnet control-only scores without making Sonnet a target critic', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-analyze-'));
    writeScore(root, 'target-r01-none-qwen-qwen3-5-plus-02-15.json', {
      critic: 'qwen/qwen3.5-plus-02-15',
      formClass: 'flat',
    });
    writeScore(root, 'target-r01-reframe-qwen-qwen3-5-plus-02-15.json', {
      critic: 'qwen/qwen3.5-plus-02-15',
      formClass: 'recognition',
    });
    writeScore(root, 'control-r01-d4-qwen-qwen3-5-plus-02-15.json', {
      critic: 'qwen/qwen3.5-plus-02-15',
      formClass: 'flat',
    });
    writeScore(root, 'control-r01-d10-emphatic-qwen-qwen3-5-plus-02-15.json', {
      critic: 'qwen/qwen3.5-plus-02-15',
      formClass: 'trap',
    });
    writeScore(root, 'control-r01-d10-emphatic-anthropic-claude-sonnet-4-6.json', {
      critic: 'anthropic/claude-sonnet-4.6',
      formClass: 'recognition',
    });

    const summary = buildSummary(root);

    assert.deepEqual(
      summary.critics.map((critic) => critic.id),
      ['qwen'],
    );
    assert.deepEqual(
      summary.controlCritics.map((critic) => critic.id),
      ['qwen', 'sonnet46'],
    );
    const d10 = summary.controls.find((row) => row.control === 'd10-emphatic');
    assert.equal(d10.role, 'boundary_trap_control');
    assert.equal(d10.critics.sonnet46.form, 'recognition');
    assert.match(renderControlTable(summary), /boundary_trap_control/);
  });
});
