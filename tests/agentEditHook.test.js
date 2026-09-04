import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const ROOT = path.join(import.meta.dirname, '..');
const HOOK = path.join(ROOT, 'scripts', 'agent-edit-hook.js');

function temporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-edit-hook-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function runHook(mode, input) {
  return spawnSync(process.execPath, [HOOK, mode], {
    input: JSON.stringify(input),
    encoding: 'utf8',
  });
}

function writeExecutable(file, source) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, source, { mode: 0o755 });
}

function fakeToolchain(base) {
  const bin = path.join(base, 'node_modules', '.bin');
  writeExecutable(
    path.join(bin, 'eslint'),
    `#!/usr/bin/env node
const fs = require('node:fs');
const file = process.argv.at(-1);
const source = fs.readFileSync(file, 'utf8');
if (source.includes('lint_error')) {
  console.error('fake no-undef');
  process.exit(1);
}
fs.appendFileSync(file, '\\n// linted');
`,
  );
  writeExecutable(
    path.join(bin, 'prettier'),
    `#!/usr/bin/env node
require('node:fs').appendFileSync(process.argv.at(-1), '\\n// formatted');
`,
  );
}

test('Claude and Codex share the same repository-owned edit hooks', () => {
  const claude = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude', 'settings.json'), 'utf8'));
  const codex = JSON.parse(fs.readFileSync(path.join(ROOT, '.codex', 'hooks.json'), 'utf8'));
  for (const phase of ['PreToolUse', 'PostToolUse']) {
    assert.equal(claude.hooks[phase][0].hooks[0].command, codex.hooks[phase][0].hooks[0].command);
    assert.match(claude.hooks[phase][0].hooks[0].command, /scripts\/agent-edit-hook\.js/u);
  }
});

test('live agent guidance does not advertise the retired Electron target', () => {
  for (const file of ['CLAUDE.md', 'GEMINI.md']) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.doesNotMatch(source, /npm run desktop:|desktop\/README\.md|desktop\/paths\.js/u, file);
  }
});

test('protected environment filenames are blocked with provider-neutral guidance', () => {
  const result = runHook('protect-env', { tool_input: { file_path: '/tmp/.env.team.local' } });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /not through an agent/u);
  assert.doesNotMatch(result.stderr, /Claude|Codex/u);
});

test('non-JavaScript and files outside an ESLint project are skipped', (t) => {
  const directory = temporaryDirectory(t);
  assert.equal(runHook('lint-js', { cwd: directory, tool_input: { file_path: 'note.md' } }).status, 0);
  assert.equal(runHook('lint-js', { cwd: directory, tool_input: { file_path: 'scratch.js' } }).status, 0);
});

test('a worktree can use an ancestor install and paths are passed without a shell', (t) => {
  const base = temporaryDirectory(t);
  fakeToolchain(base);
  const project = path.join(base, '.codex', 'worktrees', 'audit');
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(path.join(project, 'eslint.config.js'), 'export default [];\n');
  const file = path.join(project, 'safe;touch never-created.js');
  fs.writeFileSync(file, 'const answer = 42;\n');

  const result = runHook('lint-js', { cwd: project, tool_input: { file_path: path.basename(file) } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(fs.readFileSync(file, 'utf8'), /linted[\s\S]*formatted/u);
  assert.equal(fs.existsSync(path.join(project, 'never-created.js')), false);
});

test('missing toolchains are reported without mislabeling an edit as a lint failure', (t) => {
  const project = temporaryDirectory(t);
  fs.writeFileSync(path.join(project, 'eslint.config.js'), 'export default [];\n');
  fs.writeFileSync(path.join(project, 'clean.js'), 'const answer = 42;\n');
  const result = runHook('lint-js', { cwd: project, tool_input: { file_path: 'clean.js' } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /run npm install/u);
});

test('remaining ESLint errors block the edit after formatting runs', (t) => {
  const base = temporaryDirectory(t);
  fakeToolchain(base);
  const project = path.join(base, 'project');
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, 'eslint.config.js'), 'export default [];\n');
  const file = path.join(project, 'bad.js');
  fs.writeFileSync(file, 'lint_error\n');

  const result = runHook('lint-js', { cwd: project, tool_input: { file_path: file } });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /fake no-undef/u);
  assert.match(fs.readFileSync(file, 'utf8'), /formatted/u);
});
