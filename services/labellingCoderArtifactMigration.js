import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveWorkspace, safeCoderId } from './humanCodingStore.js';
import { CODER_IDENTITY_SCHEMA, coderArtifactToken, coderIdFromArtifactToken } from './labellingCoderIdentity.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TAXONOMY_PREFIX = 'human-validation-pilot-rater-';
const IMPASSE_PREFIX = 'impasse-corpus-phase1-rater-';

function impasseOutputDir(env) {
  return path.resolve(env.LABELLING_GAME_IMPASSE_OUTPUT_DIR || env.EVAL_EXPORTS_DIR || path.join(ROOT, 'exports'));
}

function mappedCoderId(mapping, datasetId, artifactKey) {
  return mapping?.[datasetId]?.[artifactKey] ?? null;
}

function migrationEntry({ datasetId, sourcePath, prefix, extension, artifactKey, inferredCoderId, mapping }) {
  const decodedCoderId = coderIdFromArtifactToken(artifactKey);
  if (decodedCoderId) {
    return {
      dataset_id: datasetId,
      source_path: sourcePath,
      target_path: sourcePath,
      artifact_key: artifactKey,
      coder_id: decodedCoderId,
      identity_source: 'artifact_token',
      status: 'current',
    };
  }

  const mapped = mappedCoderId(mapping, datasetId, artifactKey);
  const coderId = safeCoderId(mapped ?? inferredCoderId ?? artifactKey);
  const targetPath = path.join(path.dirname(sourcePath), `${prefix}${coderArtifactToken(coderId)}${extension}`);
  return {
    dataset_id: datasetId,
    source_path: sourcePath,
    target_path: targetPath,
    artifact_key: artifactKey,
    coder_id: coderId,
    identity_source: mapped == null ? 'inferred_legacy' : 'mapping',
    status: fs.existsSync(targetPath) ? 'collision' : mapped == null ? 'confirmation_required' : 'ready',
  };
}

function scanTaxonomy(env, mapping) {
  const outputDir = resolveWorkspace(env).outputDir;
  if (!fs.existsSync(outputDir)) return [];
  return fs
    .readdirSync(outputDir)
    .filter((name) => name.startsWith(TAXONOMY_PREFIX) && name.endsWith('.csv'))
    .sort()
    .map((name) => {
      const artifactKey = name.slice(TAXONOMY_PREFIX.length, -'.csv'.length);
      return migrationEntry({
        datasetId: 'superego-taxonomy',
        sourcePath: path.join(outputDir, name),
        prefix: TAXONOMY_PREFIX,
        extension: '.csv',
        artifactKey,
        inferredCoderId: artifactKey,
        mapping,
      });
    });
}

function scanImpasses(env, mapping) {
  const outputDir = impasseOutputDir(env);
  if (!fs.existsSync(outputDir)) return [];
  return fs
    .readdirSync(outputDir)
    .filter((name) => name.startsWith(IMPASSE_PREFIX) && name.endsWith('.json'))
    .sort()
    .map((name) => {
      const sourcePath = path.join(outputDir, name);
      const artifactKey = name.slice(IMPASSE_PREFIX.length, -'.json'.length);
      let parsed;
      try {
        parsed = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
      } catch (error) {
        return {
          dataset_id: 'tutor-stub-impasses',
          source_path: sourcePath,
          target_path: null,
          artifact_key: artifactKey,
          coder_id: null,
          identity_source: 'invalid_sidecar',
          status: 'invalid',
          error: error.message,
        };
      }
      const entry = migrationEntry({
        datasetId: 'tutor-stub-impasses',
        sourcePath,
        prefix: IMPASSE_PREFIX,
        extension: '.json',
        artifactKey,
        inferredCoderId: parsed.coder_id || artifactKey,
        mapping,
      });
      if (entry.status === 'current') {
        try {
          const storedCoderId = safeCoderId(parsed.coder_id);
          if (
            storedCoderId !== entry.coder_id ||
            parsed.coder_identity?.schema !== CODER_IDENTITY_SCHEMA ||
            parsed.coder_identity?.artifact_token !== artifactKey
          ) {
            entry.status = 'invalid';
            entry.error = 'coder identity metadata does not match the artifact filename';
          }
        } catch (error) {
          entry.status = 'invalid';
          entry.error = error.message;
        }
      }
      return { ...entry, parsed };
    });
}

function markPlannedCollisions(entries) {
  const byTarget = new Map();
  for (const entry of entries) {
    if (!entry.target_path || entry.status === 'current' || entry.status === 'invalid') continue;
    const existing = byTarget.get(entry.target_path);
    if (existing) {
      existing.status = 'collision';
      entry.status = 'collision';
    } else {
      byTarget.set(entry.target_path, entry);
    }
  }
}

function publicEntry(entry) {
  const { parsed: _parsed, ...rest } = entry;
  return rest;
}

export function inspectLabellingCoderArtifacts({ env = process.env, mapping = {} } = {}) {
  const entries = [...scanTaxonomy(env, mapping), ...scanImpasses(env, mapping)];
  markPlannedCollisions(entries);
  return {
    schema: 'machinespirits.labelling-game.coder-artifact-migration.v1',
    entries: entries.map(publicEntry),
    counts: Object.fromEntries(
      ['current', 'ready', 'confirmation_required', 'collision', 'invalid'].map((status) => [
        status,
        entries.filter((entry) => entry.status === status).length,
      ]),
    ),
  };
}

function writeJsonAtomic(filePath, value) {
  const tempPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, filePath);
}

export function migrateLabellingCoderArtifacts({ env = process.env, mapping = {}, acceptInferred = false } = {}) {
  const entries = [...scanTaxonomy(env, mapping), ...scanImpasses(env, mapping)];
  markPlannedCollisions(entries);
  for (const entry of entries) {
    if (entry.status === 'confirmation_required' && acceptInferred) entry.status = 'ready';
  }
  const unresolved = entries.filter((entry) =>
    ['confirmation_required', 'collision', 'invalid'].includes(entry.status),
  );
  if (unresolved.length > 0) {
    return {
      schema: 'machinespirits.labelling-game.coder-artifact-migration.v1',
      success: false,
      migrated: [],
      entries: entries.map(publicEntry),
      unresolved: unresolved.map(publicEntry),
    };
  }

  const migrated = [];
  for (const entry of entries) {
    if (entry.status !== 'ready') continue;
    if (entry.dataset_id === 'superego-taxonomy') {
      fs.renameSync(entry.source_path, entry.target_path);
    } else {
      const sidecar = {
        ...entry.parsed,
        coder_id: entry.coder_id,
        coder_identity: {
          schema: CODER_IDENTITY_SCHEMA,
          artifact_token: coderArtifactToken(entry.coder_id),
          migrated_from: path.basename(entry.source_path),
        },
      };
      writeJsonAtomic(entry.target_path, sidecar);
      fs.unlinkSync(entry.source_path);
    }
    entry.status = 'migrated';
    migrated.push(entry.target_path);
  }
  return {
    schema: 'machinespirits.labelling-game.coder-artifact-migration.v1',
    success: true,
    migrated,
    entries: entries.map(publicEntry),
    unresolved: [],
  };
}
