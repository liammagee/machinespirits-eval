#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function nativeRebuildPlan({
  projectRoot = PROJECT_ROOT,
  nodeGypPath = process.env.npm_config_node_gyp,
  nodePath = process.execPath,
  npmPath = process.platform === 'win32' ? 'npm.cmd' : 'npm',
} = {}) {
  if (!nodeGypPath) {
    throw new Error('npm did not expose npm_config_node_gyp; run this command through npm run native:rebuild:node');
  }
  return [
    {
      label: 'better-sqlite3',
      program: npmPath,
      args: ['rebuild', 'better-sqlite3'],
      cwd: projectRoot,
    },
    {
      label: 'node-pty',
      program: nodePath,
      args: [nodeGypPath, 'rebuild', '--release'],
      cwd: path.join(projectRoot, 'node_modules', 'node-pty'),
    },
  ];
}

function run(command) {
  return new Promise((resolve, reject) => {
    const child = spawn(command.program, command.args, {
      cwd: command.cwd,
      env: process.env,
      shell: false,
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else
        reject(new Error(`${command.label} rebuild failed${signal ? ` with signal ${signal}` : ` with exit ${code}`}`));
    });
  });
}

export async function rebuildNodeNativeModules(options) {
  const plan = nativeRebuildPlan(options);
  for (const command of plan) {
    if (!fs.existsSync(command.cwd)) throw new Error(`${command.label} package directory is missing: ${command.cwd}`);
    console.log(`native:rebuild:node: ${command.label}`);
    await run(command);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  rebuildNodeNativeModules().catch((error) => {
    console.error(`native:rebuild:node: ${error.message}`);
    process.exitCode = 1;
  });
}
