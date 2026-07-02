/**
 * tutorBlueprint — loader/resolver for config/tutor-blueprint.yaml.
 *
 * The blueprint registry declares the paper's validated mechanisms as named
 * modules (evidence pointer, portability status, factor flags). This module
 * resolves a blueprint profile's module list into the merged factor flags its
 * cell must carry. The registry is enforced-as-check: cells in
 * config/tutor-agents.yaml stay explicit, and a test asserts they match
 * resolveBlueprintProfile() — no runtime indirection.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLUEPRINT_PATH = path.resolve(__dirname, '../config/tutor-blueprint.yaml');

const VALID_STATUSES = new Set(['portable', 'inherent', 'conditional', 'not_portable_v1']);

let _cache = null;
let _cacheMtimeMs = 0;

export function loadBlueprint({ blueprintPath = BLUEPRINT_PATH } = {}) {
  const stat = fs.statSync(blueprintPath);
  if (_cache && stat.mtimeMs === _cacheMtimeMs && blueprintPath === BLUEPRINT_PATH) return _cache;
  const parsed = yaml.parse(fs.readFileSync(blueprintPath, 'utf8'));
  validateBlueprint(parsed);
  if (blueprintPath === BLUEPRINT_PATH) {
    _cache = parsed;
    _cacheMtimeMs = stat.mtimeMs;
  }
  return parsed;
}

export function validateBlueprint(blueprint) {
  if (!blueprint || typeof blueprint !== 'object') throw new Error('tutorBlueprint: registry is not an object');
  if (!blueprint.version) throw new Error('tutorBlueprint: version is required');
  if (!blueprint.chassis?.base_factors) throw new Error('tutorBlueprint: chassis.base_factors is required');
  if (!blueprint.modules || typeof blueprint.modules !== 'object')
    throw new Error('tutorBlueprint: modules map is required');
  for (const [name, module] of Object.entries(blueprint.modules)) {
    if (!VALID_STATUSES.has(module?.status))
      throw new Error(`tutorBlueprint: module ${name} has invalid status ${JSON.stringify(module?.status)}`);
    if (!module.evidence) throw new Error(`tutorBlueprint: module ${name} missing evidence pointer`);
    if (module.factors != null && typeof module.factors !== 'object')
      throw new Error(`tutorBlueprint: module ${name} factors must be a map`);
    if ((module.status === 'conditional' || module.status === 'not_portable_v1') &&
        !(Array.isArray(module.caveats) && module.caveats.length > 0)) {
      throw new Error(`tutorBlueprint: module ${name} is ${module.status} but records no caveats`);
    }
  }
  for (const [profileName, profile] of Object.entries(blueprint.profiles || {})) {
    if (!profile?.cell) throw new Error(`tutorBlueprint: profile ${profileName} missing cell`);
    for (const moduleName of profile.modules || []) {
      if (!blueprint.modules[moduleName])
        throw new Error(`tutorBlueprint: profile ${profileName} references unknown module ${moduleName}`);
    }
  }
  return blueprint;
}

/**
 * Resolve a module list into { factors, profileFields, warnings }.
 * Non-portable / chassis-conflicting modules contribute no flags and emit a
 * warning line — declared, never silently dropped.
 */
export function resolveBlueprintModules(moduleNames, { blueprint = loadBlueprint() } = {}) {
  const factors = { ...(blueprint.chassis?.base_factors || {}) };
  const profileFields = {};
  const warnings = [];
  for (const name of moduleNames || []) {
    const module = blueprint.modules[name];
    if (!module) throw new Error(`tutorBlueprint: unknown module ${name}`);
    if (module.status === 'not_portable_v1') {
      warnings.push(`module ${name} is not_portable_v1 and contributes no flags`);
      continue;
    }
    if (module.conflicts_with === 'chassis') {
      warnings.push(`module ${name} conflicts with the chassis and contributes no flags`);
      continue;
    }
    for (const [key, value] of Object.entries(module.factors || {})) {
      if (key in factors && JSON.stringify(factors[key]) !== JSON.stringify(value)) {
        throw new Error(`tutorBlueprint: module ${name} factor ${key} conflicts with an earlier module`);
      }
      factors[key] = value;
    }
    for (const [key, value] of Object.entries(module.profile_fields || {})) {
      profileFields[key] = value;
    }
  }
  return { factors, profileFields, warnings };
}

export function resolveBlueprintProfile(profileName, { blueprint = loadBlueprint() } = {}) {
  const profile = blueprint.profiles?.[profileName];
  if (!profile) throw new Error(`tutorBlueprint: unknown blueprint profile ${profileName}`);
  return {
    cell: profile.cell,
    modules: [...(profile.modules || [])],
    ...resolveBlueprintModules(profile.modules, { blueprint }),
  };
}

export function listBlueprintProfiles({ blueprint = loadBlueprint() } = {}) {
  return Object.keys(blueprint.profiles || {});
}
