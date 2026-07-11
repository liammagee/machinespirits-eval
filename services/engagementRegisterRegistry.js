import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import yaml from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ENGAGEMENT_REGISTER_REGISTRY_PATH = path.join(__dirname, '..', 'config', 'engagement-registers.yaml');

let registryCache = null;
let registryMtime = null;

function readRegistryFile() {
  const stats = fs.statSync(ENGAGEMENT_REGISTER_REGISTRY_PATH);
  if (registryCache && registryMtime === stats.mtimeMs) return registryCache;
  const parsed = yaml.parse(fs.readFileSync(ENGAGEMENT_REGISTER_REGISTRY_PATH, 'utf-8')) || {};
  registryCache = parsed;
  registryMtime = stats.mtimeMs;
  return registryCache;
}

export function loadEngagementRegisterRegistry({ forceReload = false } = {}) {
  if (forceReload) {
    registryCache = null;
    registryMtime = null;
  }
  return readRegistryFile();
}

export function getEngagementStanceDefinitions() {
  const registry = loadEngagementRegisterRegistry();
  return registry.engagement_stances || registry.registers || {};
}

export const getEngagementRegisterDefinitions = getEngagementStanceDefinitions;

export function getRegisterOntologyVersion() {
  return loadEngagementRegisterRegistry().register_ontology_version || 1;
}

export function getCommunicativePragmatics() {
  return loadEngagementRegisterRegistry().communicative_pragmatics || {};
}

export function getLegacyEngagementRegisterAliases() {
  return loadEngagementRegisterRegistry().legacy_register_aliases || {};
}

export function getEngagementStanceNames({ includeArmAssigned = true } = {}) {
  return Object.entries(getEngagementStanceDefinitions())
    .filter(([, definition]) => includeArmAssigned || definition.router_selectable !== false)
    .map(([name]) => name);
}

export const getEngagementRegisterNames = getEngagementStanceNames;

export function getLegacyEngagementRegisterNames() {
  return Object.keys(getLegacyEngagementRegisterAliases());
}

export function resolveEngagementStance(name, { fallback = null } = {}) {
  const raw = typeof name === 'string' ? name.trim() : '';
  const definitions = getEngagementStanceDefinitions();
  const aliases = getLegacyEngagementRegisterAliases();
  const ontologyVersion = getRegisterOntologyVersion();

  if (raw && definitions[raw]) {
    return {
      input: raw,
      register: raw,
      selected_register: raw,
      canonical_register: raw,
      legacy_selected_register: null,
      legacy_register: null,
      request_type: null,
      action_family: null,
      definition: definitions[raw],
      ontology_version: ontologyVersion,
      alias: null,
    };
  }

  const alias = raw ? aliases[raw] : null;
  const aliasRegister = alias?.register || alias?.selected_register || alias?.canonical_register;
  if (aliasRegister && definitions[aliasRegister]) {
    return {
      input: raw,
      register: aliasRegister,
      selected_register: aliasRegister,
      canonical_register: aliasRegister,
      legacy_selected_register: raw,
      legacy_register: raw,
      request_type: alias.request_type || null,
      action_family: alias.action_family || null,
      definition: definitions[aliasRegister],
      ontology_version: ontologyVersion,
      alias,
    };
  }

  if (fallback && definitions[fallback]) {
    return {
      input: raw,
      register: fallback,
      selected_register: fallback,
      canonical_register: fallback,
      legacy_selected_register: raw || null,
      legacy_register: raw || null,
      request_type: null,
      action_family: null,
      definition: definitions[fallback],
      ontology_version: ontologyVersion,
      alias: null,
      fallback: true,
    };
  }

  return null;
}

export const resolveEngagementRegister = resolveEngagementStance;

export function getEngagementStanceDefinition(name) {
  const resolved = resolveEngagementStance(name);
  if (!resolved) return null;
  return {
    ...resolved.definition,
    canonical_register: resolved.register,
    legacy_selected_register: resolved.legacy_selected_register,
    legacy_register: resolved.legacy_register,
    request_type: resolved.request_type,
    action_family: resolved.action_family,
    ontology_version: resolved.ontology_version,
  };
}

export const getEngagementRegisterDefinition = getEngagementStanceDefinition;

export function getEngagementStancePragmatics(name) {
  const model = getCommunicativePragmatics();
  const defaults = model.register_realization || {};
  const definition = getEngagementStanceDefinition(name);
  if (!definition) return null;
  return {
    address_structure: defaults.default_address_structure || null,
    audience_presence: defaults.default_audience_presence || null,
    audience_alignment: defaults.default_audience_alignment || null,
    ...(definition.pragmatics || {}),
  };
}

export function getRoutingPatternGroups() {
  return loadEngagementRegisterRegistry().routing_patterns || {};
}

export function getRequestTypeDefinitions() {
  return loadEngagementRegisterRegistry().request_types || {};
}

export function getActionFamilyDefinitions() {
  return loadEngagementRegisterRegistry().action_families || {};
}

export function getAddresseeProfileDefinitions() {
  return loadEngagementRegisterRegistry().audience_registers || {};
}

// Backward-compatible API: persisted `audience_register` values are addressee
// profiles, not instances of the separate dramatic Audience position.
export const getAudienceRegisterDefinitions = getAddresseeProfileDefinitions;

export function getLexicalAccessibilityDefinitions() {
  return loadEngagementRegisterRegistry().lexical_accessibility_levels || {};
}

export function getSceneImmersionDefinitions() {
  return loadEngagementRegisterRegistry().scene_immersion_levels || {};
}

export function getResistanceSignalDefinitions() {
  return loadEngagementRegisterRegistry().resistance_signals || {};
}

export function getResistanceStrategies() {
  return loadEngagementRegisterRegistry().resistance_strategies || {};
}

export function getRegisterRubricPath(registerName) {
  const rubric = resolveEngagementStance(registerName)?.definition?.rubric;
  return rubric && rubric !== 'null' ? rubric : null;
}
