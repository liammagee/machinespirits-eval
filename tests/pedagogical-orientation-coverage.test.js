/**
 * Pedagogical Orientation Coverage Test
 *
 * The chat UI (routes/chatRoutes.js + public/chat/) groups cells by pedagogical
 * orientation family using the `pedagogical_orientations:` map at the top of
 * config/tutor-agents.yaml. The map is keyed by `factors.prompt_type` values.
 *
 * If a future cell introduces a new `prompt_type` without registering an entry
 * in the orientations map, the chat UI will silently drop the cell from the
 * family-grouped selector. This test catches that pattern, mirroring bug_007's
 * dispatch-chain coverage check (see tests/regression-bug-007.test.js).
 *
 * Two assertions:
 *   (1) Every prompt_type used by any cell_* profile has an orientations entry.
 *   (2) Every orientations entry has all required fields populated.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, '..', 'config', 'tutor-agents.yaml');
const tutorConfig = yaml.parse(fs.readFileSync(configPath, 'utf8'));
const profiles = tutorConfig.profiles || {};
const orientations = tutorConfig.pedagogical_orientations || {};

const REQUIRED_FIELDS = [
  'family',
  'short_label',
  'lineage',
  'view_of_learner',
  'role_of_tutor',
  'key_mechanism',
  'vocabulary',
];

const VALID_FAMILIES = new Set([
  'transmission',
  'neutral',
  'intersubjective',
  'architectural_variant',
]);

describe('pedagogical orientation coverage', () => {
  it('every cell_* profile prompt_type has an entry in pedagogical_orientations', () => {
    const missing = new Set();
    for (const [cellName, profile] of Object.entries(profiles)) {
      if (!cellName.startsWith('cell_')) continue;
      const promptType = profile?.factors?.prompt_type;
      if (!promptType) continue;
      if (!orientations[promptType]) missing.add(promptType);
    }

    assert.strictEqual(
      missing.size,
      0,
      `Missing pedagogical_orientations entries for prompt_type(s): ${[...missing].sort().join(', ')}.\n\nFix: add an entry to the pedagogical_orientations: map at the top of config/tutor-agents.yaml. See docs/pedagogical-taxonomy.md for the schema.`,
    );
  });

  it('every orientation entry has the required schema fields populated', () => {
    const failures = [];
    for (const [promptType, orientation] of Object.entries(orientations)) {
      if (!orientation || typeof orientation !== 'object') {
        failures.push({ promptType, reason: 'entry is not an object' });
        continue;
      }
      for (const field of REQUIRED_FIELDS) {
        const value = orientation[field];
        if (value === undefined || value === null || value === '') {
          failures.push({ promptType, missingField: field });
          continue;
        }
        if (field === 'vocabulary' && (!Array.isArray(value) || value.length === 0)) {
          failures.push({ promptType, missingField: field, reason: 'must be non-empty array' });
        }
      }
      if (orientation.family && !VALID_FAMILIES.has(orientation.family)) {
        failures.push({
          promptType,
          field: 'family',
          value: orientation.family,
          reason: `not in known set ${[...VALID_FAMILIES].join('/')}`,
        });
      }
    }

    assert.strictEqual(
      failures.length,
      0,
      `Pedagogical orientations have schema gaps:\n${JSON.stringify(failures, null, 2)}`,
    );
  });
});
