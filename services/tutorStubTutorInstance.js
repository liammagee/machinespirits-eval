import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_REGISTRY = path.join(ROOT, 'config', 'tutor-instances.yaml');
const ID_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/u;

export const TUTOR_STUB_TUTOR_INSTANCE_SCHEMA = 'machinespirits.tutor-stub.tutor-instance.v1';

function hashText(text) {
  return crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
}

export function parseTutorStubTutorRef(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^([a-z0-9]+(?:[-_][a-z0-9]+)*)(?:@v(\d+))?$/u);
  if (!match) throw new Error(`invalid tutor instance reference "${raw}"; expected <id> or <id>@v<number>`);
  return { id: match[1], requestedVersion: match[2] === undefined ? null : Number(match[2]) };
}

export function loadTutorStubTutorRegistry(filePath = DEFAULT_REGISTRY) {
  const absolute = path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
  const parsed = YAML.parse(fs.readFileSync(absolute, 'utf8')) || {};
  if (!parsed.instances || typeof parsed.instances !== 'object') {
    throw new Error(`tutor instance registry has no instances: ${absolute}`);
  }
  return { ...parsed, filePath: absolute };
}

export function listTutorStubTutorInstances({ registryPath = DEFAULT_REGISTRY } = {}) {
  const registry = loadTutorStubTutorRegistry(registryPath);
  return Object.entries(registry.instances).map(([id, value]) => ({ id, ...value }));
}

export function resolveTutorStubTutorInstance(value, { registryPath = DEFAULT_REGISTRY } = {}) {
  const registry = loadTutorStubTutorRegistry(registryPath);
  const ref = parseTutorStubTutorRef(value || registry.default);
  if (!ID_PATTERN.test(ref.id) || !registry.instances[ref.id]) {
    throw new Error(`unknown tutor instance "${ref.id}"; available: ${Object.keys(registry.instances).join(', ')}`);
  }
  const source = registry.instances[ref.id];
  const sourceVersion = Number(source.source_version || 1);
  const rolePromptPath = path.isAbsolute(source.role_prompt)
    ? source.role_prompt
    : path.join(ROOT, source.role_prompt);
  const rolePrompt = fs.readFileSync(rolePromptPath, 'utf8').trim();
  return {
    schema: TUTOR_STUB_TUTOR_INSTANCE_SCHEMA,
    id: ref.id,
    ref: `${ref.id}@v${ref.requestedVersion ?? sourceVersion}`,
    title: String(source.title || ref.id),
    description: String(source.description || ''),
    sourceVersion,
    requestedVersion: ref.requestedVersion,
    rolePrompt,
    rolePromptPath,
    rolePromptHash: hashText(rolePrompt),
    policyPack: { ...(source.policy_pack || {}) },
    modelDefaults: { ...(source.model_defaults || {}) },
    registryPath: registry.filePath,
  };
}

export function tutorStubTutorInstancePrompt(instance) {
  if (!instance?.rolePrompt) return '';
  return [
    `[Named tutor instance: ${instance.title} (${instance.id})]`,
    instance.rolePrompt,
    '[End named tutor instance]',
  ].join('\n');
}
