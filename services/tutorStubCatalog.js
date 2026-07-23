import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadProviders } from './evalConfigLoader.js';
import { loadWorld } from './dramaticDerivation/world.js';
import { listTutorStubLabs } from './tutorStubLabs.js';
import { listTutorStubTutorInstances } from './tutorStubTutorInstance.js';

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const TUTOR_STUB_PUBLIC_CATALOG_SCHEMA = 'machinespirits.tutor-stub.public-catalog.v1';
export const TUTOR_STUB_PUBLIC_CATALOG_VERSION = 1;

const WEB_LAUNCH = Object.freeze({
  pure_chat: Object.freeze({ engine: 'tutor_stub', mode: 'passthrough', available: true, requiresWorld: false }),
  human_scaffold: Object.freeze({ engine: 'tutor_stub', mode: 'scaffold', available: true, requiresWorld: true }),
  mixed_drafting: Object.freeze({
    engine: 'tutor_stub',
    mode: 'mixed',
    available: false,
    requiresWorld: true,
    unavailableReason: 'Draft suggestion, acceptance, and regeneration commands are not available through HTTP yet.',
  }),
  coaching: Object.freeze({
    engine: 'tutor_stub',
    mode: 'scaffold',
    available: false,
    requiresWorld: true,
    unavailableReason: 'Private coach role switching is not available through the browser transport yet.',
  }),
  voice: Object.freeze({
    engine: 'tutor_stub',
    mode: 'scaffold',
    available: false,
    requiresWorld: true,
    unavailableReason:
      'The server voice companion is not available here; opt-in browser transcription remains available.',
  }),
  curriculum: Object.freeze({
    engine: 'tutor_stub',
    mode: 'curriculum',
    available: false,
    requiresWorld: false,
    unavailableReason:
      'Choose a curriculum and module in the terminal until browser curriculum controls are available.',
  }),
});

function providerLabel(providerId) {
  return String(providerId)
    .split(/[-_]/u)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function listProductionWorlds(root) {
  const worldDir = path.join(root, 'config', 'drama-derivation');
  return fs
    .readdirSync(worldDir)
    .filter((file) => /^world-.*\.yaml$/u.test(file))
    .sort((left, right) => left.localeCompare(right))
    .map((file) => loadWorld(path.join(worldDir, file)))
    .filter((world) => world.eligibility?.status === 'production')
    .map((world) => ({
      id: world.id,
      title: world.title,
      question: world.question,
      discipline: world.discipline,
      summary: world.presentation?.summary || null,
    }));
}

function listPublicTutorInstances(root) {
  const registryPath = path.join(root, 'config', 'tutor-instances.yaml');
  return listTutorStubTutorInstances({ registryPath }).map((instance) => ({
    id: instance.id,
    ref: `${instance.id}@v${Number(instance.source_version || 1)}`,
    title: String(instance.title || instance.id),
    description: String(instance.description || ''),
    sourceVersion: Number(instance.source_version || 1),
  }));
}

function listPublicModelAliases() {
  const providers = loadProviders()?.providers || {};
  return Object.entries(providers)
    .flatMap(([provider, config]) =>
      Object.keys(config?.models || {}).map((alias) => ({
        provider,
        alias,
        ref: `${provider}.${alias}`,
        label: `${providerLabel(provider)} · ${alias}`,
      })),
    )
    .sort((left, right) => left.ref.localeCompare(right.ref));
}

/**
 * Build the browser-safe projection used by the shared web/Electron tutor UI.
 * It deliberately omits world secrets and premise graphs, tutor prompts and
 * policy packs, resolved model IDs, provider endpoints, key names, and keys.
 */
export function buildTutorStubPublicCatalog({ root = DEFAULT_ROOT } = {}) {
  const labs = listTutorStubLabs({ audience: 'learner_safe' }).map((entry) => ({
    ...entry,
    launch: {
      ...(WEB_LAUNCH[entry.id] || {
        engine: 'tutor_stub',
        mode: 'direct',
        available: false,
        requiresWorld: false,
      }),
    },
  }));
  const worlds = listProductionWorlds(root);
  const tutors = listPublicTutorInstances(root);
  const models = listPublicModelAliases();
  const defaultModel = models.some((model) => model.ref === 'codex.gpt-5.6-terra')
    ? 'codex.gpt-5.6-terra'
    : models[0]?.ref || null;
  return {
    schema: TUTOR_STUB_PUBLIC_CATALOG_SCHEMA,
    version: TUTOR_STUB_PUBLIC_CATALOG_VERSION,
    defaults: {
      lab: labs.some((lab) => lab.id === 'pure_chat')
        ? 'pure_chat'
        : labs.find((lab) => lab.launch.available)?.id || null,
      world: worlds[0]?.id || 'none',
      tutor: tutors[0]?.ref || null,
      model: defaultModel,
    },
    labs,
    worlds,
    tutors,
    models,
  };
}

export default buildTutorStubPublicCatalog;
