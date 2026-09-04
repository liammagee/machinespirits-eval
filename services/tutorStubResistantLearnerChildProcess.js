import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Neutral process transport used by the zero-call bridge smoke. Paid study
 * launchers must put their own admission or retirement boundary in front of
 * this low-level transport.
 */
export function runTutorStubResistantLearnerChildProcess(spec) {
  return new Promise((resolve) => {
    const stdout = fs.openSync(spec.stdout, 'wx');
    const stderr = fs.openSync(spec.stderr, 'wx');
    const child = spawn(process.execPath, spec.args, { cwd: ROOT, env: spec.env, stdio: ['ignore', stdout, stderr] });
    child.on('error', (error) => {
      fs.closeSync(stdout);
      fs.closeSync(stderr);
      resolve({ code: null, signal: null, spawn_error: error.message });
    });
    child.on('close', (code, signal) => {
      fs.closeSync(stdout);
      fs.closeSync(stderr);
      resolve({ code, signal, spawn_error: null });
    });
  });
}
