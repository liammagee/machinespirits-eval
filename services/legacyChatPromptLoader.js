import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Resolve an eval-cell chat prompt without coupling callers to Express. */
export function loadPromptFile(filename, { root = DEFAULT_ROOT } = {}) {
  if (!filename) return '';
  const local = path.join(root, 'prompts', filename);
  if (fs.existsSync(local)) return fs.readFileSync(local, 'utf8');
  const core = path.join(root, 'tutor-core', 'prompts', filename);
  if (fs.existsSync(core)) return fs.readFileSync(core, 'utf8');
  return '';
}

export default loadPromptFile;
