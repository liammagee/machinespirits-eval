#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function readHookInput() {
  const raw = fs.readFileSync(0, 'utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function editedFile(input) {
  return typeof input?.tool_input?.file_path === 'string' ? input.tool_input.file_path : '';
}

function findUp(start, predicate) {
  let directory = path.resolve(start);
  while (true) {
    const found = predicate(directory);
    if (found) return found;
    const parent = path.dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}

function protectEnvironmentFile(input) {
  const file = editedFile(input);
  const basename = path.basename(file);
  const protectedName =
    basename === '.env' ||
    basename === '.env.local' ||
    basename === '.env.production' ||
    basename === '.env.development' ||
    /^\.env\..+\.local$/u.test(basename);
  if (!protectedName) return 0;

  console.error(`Blocked: ${basename} can hold live API keys; edit it manually, not through an agent.`);
  return 2;
}

function lintJavaScriptFile(input) {
  const file = editedFile(input);
  if (!file.endsWith('.js')) return 0;

  const hookCwd = (typeof input?.cwd === 'string' && input.cwd) || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const absoluteFile = path.resolve(hookCwd, file);
  const projectRoot = findUp(path.dirname(absoluteFile), (directory) =>
    fs.existsSync(path.join(directory, 'eslint.config.js')) ? directory : null,
  );
  if (!projectRoot) return 0;

  const relative = path.relative(projectRoot, absoluteFile);
  if (relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return 0;

  const binDirectory = findUp(projectRoot, (directory) => {
    const candidate = path.join(directory, 'node_modules', '.bin');
    return fs.existsSync(path.join(candidate, 'eslint')) ? candidate : null;
  });
  if (!binDirectory) {
    console.error(
      `Hook skipped lint on ${file}: no node_modules/.bin/eslint at or above ${projectRoot}; run npm install.`,
    );
    return 1;
  }

  const lint = spawnSync(path.join(binDirectory, 'eslint'), ['--fix', absoluteFile], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
  const prettier = path.join(binDirectory, 'prettier');
  if (fs.existsSync(prettier)) {
    spawnSync(prettier, ['--write', absoluteFile], { cwd: projectRoot, stdio: 'ignore' });
  }

  if (lint.error) {
    console.error(`Hook could not run ESLint on ${file}: ${lint.error.message}`);
    return 1;
  }
  if (lint.status === 0) return 0;

  console.error(
    `Hook ran eslint --fix + prettier on ${file}, but ESLint errors remain (npm run lint / CI will fail); fix these now:`,
  );
  const output = `${lint.stdout || ''}${lint.stderr || ''}`.trim();
  if (output) console.error(output);
  return 2;
}

const input = readHookInput();
const mode = process.argv[2];
const status =
  mode === 'protect-env' ? protectEnvironmentFile(input) : mode === 'lint-js' ? lintJavaScriptFile(input) : 1;
process.exitCode = status;

export { editedFile, findUp, lintJavaScriptFile, protectEnvironmentFile };
