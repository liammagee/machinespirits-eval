import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import YAML from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PROVIDERS_PATH = path.join(ROOT, 'config', 'providers.yaml');

/**
 * Environment for a spawned tutor-stub whose output is pinned byte-for-byte.
 *
 * A provider is listed in the model-choice block when its API key env var is
 * set, so a developer machine with keys prints a longer block than CI does and
 * the byte/hash pin fails for a reason that has nothing to do with the code.
 * Keys arrive two ways: the shell, and the repo's own .env, which the child
 * reads through `import 'dotenv/config'`. Drop every key named in
 * config/providers.yaml and point dotenv at a file that is not there, so the
 * block follows the config alone.
 */
export function credentialFreeChildEnv(overrides = {}) {
  const providers = YAML.parse(fs.readFileSync(PROVIDERS_PATH, 'utf8'))?.providers || {};
  const env = { ...process.env };
  for (const config of Object.values(providers)) {
    if (config?.api_key_env) delete env[config.api_key_env];
  }
  // Reading the list from the YAML rather than naming the four current vars
  // means a provider added later is scrubbed without touching this file.
  env.DOTENV_CONFIG_PATH = path.join(ROOT, 'tests', 'helpers', 'absent.env');
  env.DOTENV_CONFIG_QUIET = 'true';
  return { ...env, ...overrides };
}
