/**
 * Green Room store — profiles, the prompt book (MEMORY.md), and the training
 * ledger. First-wave substrate per GREEN-ROOM-PLAN.md §5.1 / §8 P1.
 *
 * Files are the source of truth (committed or bundle-archived per the §0.2.4
 * no-machine-local-provenance rule); the evaluation-DB index tables arrive at
 * the factorial fold-in stage, not here. Layout under $GREENROOM_DIR
 * (default <repo>/data/greenroom):
 *
 *   profiles/<id>/profile.yaml     actor model, anchor, frozen flag, version
 *   profiles/<id>/MEMORY.md        current prompt book (token-budgeted)
 *   profiles/<id>/versions/vNNN.md immutable snapshots, one per version
 *   profiles/<id>/ledger.jsonl     append-only training ledger
 *   profiles/<id>/sessions/        coach notes-session records
 *
 * Budget discipline: applyMemoryPatch refuses (E_BUDGET) rather than
 * truncates — distillation is an explicit coach act via replaceMemory.
 * Frozen discipline: a frozen profile refuses every durable write.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const MEMORY_TOKEN_BUDGET = 1800; // ratified 2026-07-11 (plan §5.1)

export const MEMORY_SECTIONS = [
  'Standing role notes',
  'Technique',
  'Recurring patterns',
  'Scenario cues',
  'Learner-type adjustments',
  'Open experiments',
];

const PROFILE_ID_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

export function resolveGreenroomDir() {
  return process.env.GREENROOM_DIR || path.join(REPO_ROOT, 'data', 'greenroom');
}

function profileDir(id) {
  return path.join(resolveGreenroomDir(), 'profiles', id);
}

export function memoryHash(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

export function estimateTokens(text) {
  return Math.ceil(String(text).length / 4);
}

function emptyMemoryTemplate(id) {
  const sections = MEMORY_SECTIONS.map((s) => `## ${s}\n`).join('\n');
  return `# Prompt Book — ${id}\n\n${sections}`;
}

function readProfileMeta(id) {
  const metaPath = path.join(profileDir(id), 'profile.yaml');
  if (!fs.existsSync(metaPath)) throw new Error(`greenroom: no such profile "${id}"`);
  return YAML.parse(fs.readFileSync(metaPath, 'utf8'));
}

function writeProfileMeta(id, meta) {
  fs.writeFileSync(path.join(profileDir(id), 'profile.yaml'), YAML.stringify(meta));
}

function appendLedger(id, event) {
  const entry = { ts: new Date().toISOString(), ...event };
  fs.appendFileSync(path.join(profileDir(id), 'ledger.jsonl'), `${JSON.stringify(entry)}\n`);
  return entry;
}

export function readLedger(id) {
  const ledgerPath = path.join(profileDir(id), 'ledger.jsonl');
  if (!fs.existsSync(ledgerPath)) return [];
  return fs
    .readFileSync(ledgerPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function snapshotMemory(id, version, text) {
  const dir = path.join(profileDir(id), 'versions');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `v${String(version).padStart(3, '0')}.md`), text);
}

function writeMemory(id, meta, newText, { source = null, type }) {
  const tokens = estimateTokens(newText);
  if (tokens > MEMORY_TOKEN_BUDGET) {
    const err = new Error(
      `greenroom: memory for "${id}" would be ${tokens} tokens (budget ${MEMORY_TOKEN_BUDGET}); distill instead of appending`,
    );
    err.code = 'E_BUDGET';
    throw err;
  }
  const beforeText = fs.readFileSync(path.join(profileDir(id), 'MEMORY.md'), 'utf8');
  const beforeHash = memoryHash(beforeText);
  const afterHash = memoryHash(newText);
  const version = (meta.memory_version || 0) + 1;
  fs.writeFileSync(path.join(profileDir(id), 'MEMORY.md'), newText);
  snapshotMemory(id, version, newText);
  meta.memory_version = version;
  writeProfileMeta(id, meta);
  const event = appendLedger(id, {
    type,
    source,
    version,
    before_hash: beforeHash,
    after_hash: afterHash,
    tokens,
  });
  return { version, hash: afterHash, tokens, event };
}

export function createProfile({ id, actorModel, anchor = 'world-005-marrick', role = null }) {
  if (!PROFILE_ID_PATTERN.test(String(id))) {
    throw new Error(`greenroom: profile id must be a slug, got "${id}"`);
  }
  const dir = profileDir(id);
  if (fs.existsSync(dir)) throw new Error(`greenroom: profile "${id}" already exists`);
  fs.mkdirSync(path.join(dir, 'versions'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'sessions'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'rehearsals'), { recursive: true });
  const memory = emptyMemoryTemplate(id);
  fs.writeFileSync(path.join(dir, 'MEMORY.md'), memory);
  snapshotMemory(id, 0, memory);
  const meta = {
    id,
    actor_model: actorModel,
    anchor,
    role,
    frozen: false,
    memory_version: 0,
    parent: null,
    created: new Date().toISOString(),
  };
  writeProfileMeta(id, meta);
  appendLedger(id, { type: 'create', version: 0, after_hash: memoryHash(memory), source: null });
  return loadProfile(id);
}

export function loadProfile(id) {
  const meta = readProfileMeta(id);
  const memoryText = fs.readFileSync(path.join(profileDir(id), 'MEMORY.md'), 'utf8');
  return {
    meta,
    dir: profileDir(id),
    memoryText,
    memoryHash: memoryHash(memoryText),
    memoryVersion: meta.memory_version || 0,
    tokens: estimateTokens(memoryText),
  };
}

export function loadMemoryVersion(id, version) {
  const file = path.join(profileDir(id), 'versions', `v${String(version).padStart(3, '0')}.md`);
  if (!fs.existsSync(file)) throw new Error(`greenroom: "${id}" has no memory version ${version}`);
  const text = fs.readFileSync(file, 'utf8');
  return { text, hash: memoryHash(text), version, tokens: estimateTokens(text) };
}

function assertWritable(id, meta) {
  if (meta.frozen) {
    const err = new Error(`greenroom: profile "${id}" is frozen; unfreeze before durable writes`);
    err.code = 'E_FROZEN';
    throw err;
  }
}

/**
 * Apply a coach memory patch: { section, op: add|edit|remove, text, match? }.
 * `add` appends a bullet under the section (creating it if absent); `edit`
 * replaces the first bullet containing `match`; `remove` deletes it.
 */
export function applyMemoryPatch(id, patch, { source = null } = {}) {
  const meta = readProfileMeta(id);
  assertWritable(id, meta);
  const { section, op = 'add', text = '', match = null } = patch || {};
  if (!section || !MEMORY_SECTIONS.includes(section)) {
    throw new Error(`greenroom: patch section must be one of [${MEMORY_SECTIONS.join(', ')}], got "${section}"`);
  }
  const current = fs.readFileSync(path.join(profileDir(id), 'MEMORY.md'), 'utf8');
  const lines = current.split('\n');
  const header = `## ${section}`;
  let headerIdx = lines.findIndex((l) => l.trim() === header);
  if (headerIdx === -1) {
    lines.push('', header, '');
    headerIdx = lines.length - 2;
  }
  let sectionEnd = lines.length;
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      sectionEnd = i;
      break;
    }
  }
  const bullet = (t) => `- ${String(t).trim().replace(/\n+/g, ' ')}`;
  if (op === 'add') {
    lines.splice(sectionEnd, 0, bullet(text));
  } else {
    const needle = match || text;
    if (!needle) throw new Error('greenroom: edit/remove patch needs match or text');
    let found = -1;
    for (let i = headerIdx + 1; i < sectionEnd; i++) {
      if (lines[i].startsWith('- ') && lines[i].includes(needle)) {
        found = i;
        break;
      }
    }
    if (found === -1) throw new Error(`greenroom: no entry matching "${needle}" in "${section}"`);
    if (op === 'edit') lines[found] = bullet(text);
    else if (op === 'remove') lines.splice(found, 1);
    else throw new Error(`greenroom: unknown patch op "${op}"`);
  }
  return writeMemory(id, meta, lines.join('\n'), { source, type: `patch:${op}` });
}

/** Whole-book rewrite — the coach's distillation act. Still budget-enforced. */
export function replaceMemory(id, newText, { source = null, type = 'distill' } = {}) {
  const meta = readProfileMeta(id);
  assertWritable(id, meta);
  return writeMemory(id, meta, newText, { source, type });
}

export function freezeProfile(id) {
  const meta = readProfileMeta(id);
  meta.frozen = true;
  writeProfileMeta(id, meta);
  appendLedger(id, { type: 'freeze', version: meta.memory_version || 0 });
  return meta;
}

export function unfreezeProfile(id) {
  const meta = readProfileMeta(id);
  meta.frozen = false;
  writeProfileMeta(id, meta);
  appendLedger(id, { type: 'unfreeze', version: meta.memory_version || 0 });
  return meta;
}

/** Fork a profile at a memory version — the training-level checkpoint op. */
export function forkProfile(srcId, version, newId) {
  if (!PROFILE_ID_PATTERN.test(String(newId))) {
    throw new Error(`greenroom: profile id must be a slug, got "${newId}"`);
  }
  const srcMeta = readProfileMeta(srcId);
  const snapshot = loadMemoryVersion(srcId, version);
  const dir = profileDir(newId);
  if (fs.existsSync(dir)) throw new Error(`greenroom: profile "${newId}" already exists`);
  fs.mkdirSync(path.join(dir, 'versions'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'sessions'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'rehearsals'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'MEMORY.md'), snapshot.text);
  snapshotMemory(newId, 0, snapshot.text);
  const meta = {
    id: newId,
    actor_model: srcMeta.actor_model,
    anchor: srcMeta.anchor,
    role: srcMeta.role || null,
    frozen: false,
    memory_version: 0,
    parent: { id: srcId, version },
    created: new Date().toISOString(),
  };
  writeProfileMeta(newId, meta);
  appendLedger(newId, {
    type: 'fork',
    version: 0,
    source: { profile: srcId, at_version: version },
    after_hash: snapshot.hash,
  });
  return loadProfile(newId);
}

export function listProfiles() {
  const root = path.join(resolveGreenroomDir(), 'profiles');
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root)
    .filter((entry) => fs.existsSync(path.join(root, entry, 'profile.yaml')))
    .sort();
}

/** Record a coach session artifact under the profile and ledger it. */
export function recordSession(id, sessionRecord, { source = null } = {}) {
  const meta = readProfileMeta(id);
  const dir = path.join(profileDir(id), 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  const existing = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).length;
  const seq = String(existing + 1).padStart(3, '0');
  const file = path.join(dir, `${seq}-notes.json`);
  fs.writeFileSync(file, JSON.stringify(sessionRecord, null, 2));
  appendLedger(id, { type: 'note', version: meta.memory_version || 0, source, session_file: path.basename(file) });
  return file;
}
