import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

import {
  loadBlueprint,
  resolveBlueprintProfile,
  resolveBlueprintModules,
  listBlueprintProfiles,
} from '../tutorBlueprint.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AGENTS_PATH = path.resolve(__dirname, '../../config/tutor-agents.yaml');

test('blueprint registry loads and validates', () => {
  const blueprint = loadBlueprint();
  assert.equal(blueprint.version, '1.0');
  assert.ok(blueprint.modules.orientation_prompt);
  assert.ok(blueprint.modules.register_router);
  assert.ok(blueprint.modules.action_contracts);
});

test('every non-portable or conditional module records caveats', () => {
  const blueprint = loadBlueprint();
  for (const [name, module] of Object.entries(blueprint.modules)) {
    if (module.status === 'not_portable_v1' || module.status === 'conditional') {
      assert.ok(
        Array.isArray(module.caveats) && module.caveats.length > 0,
        `module ${name} (${module.status}) must record caveats`,
      );
    }
  }
});

test('kernel profile resolves to chassis + orientation + router flags', () => {
  const resolved = resolveBlueprintProfile('blueprint_kernel');
  assert.equal(resolved.cell, 'cell_199_blueprint_kernel_verified');
  assert.equal(resolved.factors.id_director, true);
  assert.equal(resolved.factors.prompt_type, 'recognition');
  assert.equal(resolved.factors.engagement_mode_router, true);
  assert.equal(resolved.factors.engagement_router_resistance_owned_test, true);
  assert.equal(resolved.profileFields.recognition_mode, true);
  assert.ok(!('action_contracts' in resolved.factors));
});

test('full profile adds action_contracts on top of the kernel', () => {
  const kernel = resolveBlueprintProfile('blueprint_kernel');
  const full = resolveBlueprintProfile('blueprint_full');
  assert.equal(full.factors.action_contracts, true);
  for (const [key, value] of Object.entries(kernel.factors)) {
    assert.deepEqual(full.factors[key], value, `full profile must carry kernel factor ${key}`);
  }
});

test('non-portable and chassis-conflicting modules contribute no flags but warn', () => {
  const { factors, warnings } = resolveBlueprintModules(['pacing_guard', 'superego_error_correction']);
  const baseFactors = loadBlueprint().chassis.base_factors;
  assert.deepEqual(factors, baseFactors, 'only chassis base factors expected');
  assert.equal(warnings.length, 2);
  assert.match(warnings[0], /pacing_guard/);
  assert.match(warnings[1], /superego_error_correction/);
});

test('blueprint cells in tutor-agents.yaml carry exactly the resolved factors', () => {
  const agents = yaml.parse(fs.readFileSync(AGENTS_PATH, 'utf8'));
  const profiles = agents.profiles || agents;
  for (const profileName of listBlueprintProfiles()) {
    const resolved = resolveBlueprintProfile(profileName);
    const cell = profiles[resolved.cell];
    assert.ok(cell, `cell ${resolved.cell} must exist in tutor-agents.yaml`);
    for (const [key, value] of Object.entries(resolved.factors)) {
      assert.deepEqual(
        cell.factors?.[key],
        value,
        `${resolved.cell} factors.${key} must match blueprint resolution`,
      );
    }
    for (const [key, value] of Object.entries(resolved.profileFields)) {
      assert.deepEqual(cell[key], value, `${resolved.cell} ${key} must match blueprint resolution`);
    }
  }
});
