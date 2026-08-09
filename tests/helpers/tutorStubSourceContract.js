import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const TUTOR_STUB_APPLICATION_SOURCE_PATHS = Object.freeze([
  path.join(ROOT, 'scripts', 'tutor-stub.js'),
  path.join(ROOT, 'services', 'tutorStubCliApplicationHost.js'),
]);

/**
 * Source-level ownership tests characterize the executable entrypoint and its
 * explicit application host as one CLI composition surface. Keeping the paths
 * here prevents each test from silently reverting to the obsolete monolith.
 */
export function readTutorStubApplicationSource() {
  return TUTOR_STUB_APPLICATION_SOURCE_PATHS.map((filePath) => fs.readFileSync(filePath, 'utf8')).join('\n');
}

export function tutorStubApplicationSourcePaths() {
  return [...TUTOR_STUB_APPLICATION_SOURCE_PATHS];
}
