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

export function getEngagementRegisterDefinitions() {
  return loadEngagementRegisterRegistry().registers || {};
}

export function getEngagementRegisterNames({ includeArmAssigned = true } = {}) {
  return Object.entries(getEngagementRegisterDefinitions())
    .filter(([, definition]) => includeArmAssigned || definition.router_selectable !== false)
    .map(([name]) => name);
}

export function getEngagementRegisterDefinition(name) {
  return getEngagementRegisterDefinitions()[name] || null;
}

export function getRoutingPatternGroups() {
  return loadEngagementRegisterRegistry().routing_patterns || {};
}

export function getResistanceSignalDefinitions() {
  return loadEngagementRegisterRegistry().resistance_signals || {};
}

export function getResistanceStrategies() {
  return loadEngagementRegisterRegistry().resistance_strategies || {};
}

export function getRegisterRubricPath(registerName) {
  const rubric = getEngagementRegisterDefinition(registerName)?.rubric;
  return rubric && rubric !== 'null' ? rubric : null;
}
