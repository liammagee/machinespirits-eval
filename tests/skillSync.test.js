import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'scripts', 'sync-agent-skills.js');

function makeFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-sync-'));
  const roots = {
    agents: path.join(dir, 'agents'),
    claude: path.join(dir, 'claude'),
    codex: path.join(dir, 'codex'),
  };
  for (const root of Object.values(roots)) fs.mkdirSync(root, { recursive: true });
  const source = path.join(roots.claude, 'ms-workplan');
  fs.mkdirSync(source, { recursive: true });
  fs.writeFileSync(path.join(source, 'SKILL.md'), '---\nname: ms-workplan\n---\n\nUse the board.\n');
  const config = path.join(dir, 'config.json');
  fs.writeFileSync(
    config,
    JSON.stringify(
      {
        roots,
        mirrors: [{ name: 'ms-workplan', source: 'claude', targets: ['agents', 'codex'] }],
      },
      null,
      2,
    ),
  );
  return { dir, roots, config };
}

function run(config, args) {
  return spawnSync('node', [CLI, ...args, '--config', config], {
    encoding: 'utf8',
    cwd: ROOT,
  });
}

test('skill sync copies configured mirrors and check detects drift', () => {
  const { roots, config } = makeFixture();
  const missing = run(config, ['check']);
  assert.equal(missing.status, 1);
  assert.match(missing.stdout, /missing\tms-workplan\tclaude -> agents/);

  const sync = run(config, ['sync']);
  assert.equal(sync.status, 0, sync.stdout + sync.stderr);
  assert.ok(fs.existsSync(path.join(roots.agents, 'ms-workplan', 'SKILL.md')));
  assert.ok(fs.existsSync(path.join(roots.codex, 'ms-workplan', 'SKILL.md')));

  const ok = run(config, ['check']);
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);

  fs.writeFileSync(path.join(roots.codex, 'ms-workplan', 'SKILL.md'), 'changed\n');
  const drift = run(config, ['check']);
  assert.equal(drift.status, 1);
  assert.match(drift.stdout, /different\tms-workplan\tclaude -> codex/);
});
