import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const IMPASSE_RATER_SCHEMA = 'machinespirits.labelling-game.impasse-rater.v2';
export const IMPASSE_CORPUS_PROVENANCE_SCHEMA = 'machinespirits.labelling-game.impasse-corpus-provenance.v1';
export const IMPASSE_ITEM_HASH_FIELD = 'source_content_hash';

export class ImpasseProvenanceError extends Error {
  constructor(message, { code = 'invalid_impasse_provenance', details = null } = {}) {
    super(message);
    this.name = 'ImpasseProvenanceError';
    this.code = code;
    if (details) this.details = details;
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => [key, canonicalize(value[key])]),
  );
}

export function canonicalJsonHash(value) {
  const canonical = JSON.stringify(canonicalize(value));
  return `sha256:${crypto.createHash('sha256').update(canonical).digest('hex')}`;
}

export function validateImpasseCorpus(corpus) {
  if (!corpus || !Array.isArray(corpus.episodes)) {
    throw new ImpasseProvenanceError('impasse dataset has no episodes[] array', {
      code: 'invalid_impasse_dataset',
    });
  }
  const seen = new Set();
  for (const [index, episode] of corpus.episodes.entries()) {
    const episodeId = typeof episode?.episode_id === 'string' ? episode.episode_id.trim() : '';
    if (!episodeId) {
      throw new ImpasseProvenanceError(`impasse episode at index ${index} has no episode_id`, {
        code: 'impasse_episode_id_required',
        details: { index },
      });
    }
    if (seen.has(episodeId)) {
      throw new ImpasseProvenanceError(`duplicate impasse episode_id: ${episodeId}`, {
        code: 'duplicate_impasse_episode_id',
        details: { episode_id: episodeId },
      });
    }
    seen.add(episodeId);
  }
  return corpus;
}

export function impasseEpisodeContentHash(episode) {
  return canonicalJsonHash(episode);
}

export function buildImpasseCorpusProvenance(corpus, { source = '' } = {}) {
  validateImpasseCorpus(corpus);
  return {
    schema: IMPASSE_CORPUS_PROVENANCE_SCHEMA,
    source,
    content_hash: canonicalJsonHash(corpus),
    item_count: corpus.episodes.length,
    hash_contract: 'sha256-canonical-json-v1',
  };
}

function sidecarItems(sidecar) {
  if (!Array.isArray(sidecar?.items)) {
    throw new ImpasseProvenanceError('impasse sidecar has no items[] array', {
      code: 'invalid_impasse_sidecar',
    });
  }
  const byId = new Map();
  for (const [index, item] of sidecar.items.entries()) {
    const itemId = typeof item?.item_id === 'string' ? item.item_id.trim() : '';
    if (!itemId) {
      throw new ImpasseProvenanceError(`impasse sidecar item at index ${index} has no item_id`, {
        code: 'invalid_impasse_sidecar',
        details: { index },
      });
    }
    if (byId.has(itemId)) {
      throw new ImpasseProvenanceError(`duplicate impasse sidecar item_id: ${itemId}`, {
        code: 'duplicate_impasse_sidecar_item_id',
        details: { item_id: itemId },
      });
    }
    byId.set(itemId, item);
  }
  return byId;
}

function inspectSidecar(sidecar, corpus, { source = '' } = {}) {
  validateImpasseCorpus(corpus);
  let byId;
  try {
    byId = sidecarItems(sidecar);
  } catch (error) {
    return { status: 'invalid', issue: error };
  }
  const episodeById = new Map(corpus.episodes.map((episode) => [episode.episode_id, episode]));
  const unknownItemIds = [...byId.keys()].filter((itemId) => !episodeById.has(itemId));
  if (unknownItemIds.length) {
    return {
      status: 'invalid',
      issue: new ImpasseProvenanceError(
        `impasse sidecar contains item ids absent from the corpus: ${unknownItemIds.join(', ')}`,
        {
          code: 'impasse_sidecar_unknown_items',
          details: { item_ids: unknownItemIds },
        },
      ),
    };
  }

  const expected = buildImpasseCorpusProvenance(corpus, { source });
  const actual = sidecar?.corpus_provenance;
  const missingItemHashes = [...byId.values()].some((item) => !item[IMPASSE_ITEM_HASH_FIELD]);
  if (
    sidecar?.schema !== IMPASSE_RATER_SCHEMA ||
    !actual ||
    actual.schema !== IMPASSE_CORPUS_PROVENANCE_SCHEMA ||
    missingItemHashes
  ) {
    return {
      status: 'migration_required',
      issue: new ImpasseProvenanceError('impasse sidecar must be bound to the current corpus before use', {
        code: 'impasse_corpus_provenance_migration_required',
      }),
      expected,
      actual: actual || null,
    };
  }

  if (actual.content_hash !== expected.content_hash || actual.item_count !== expected.item_count) {
    return {
      status: 'mismatch',
      issue: new ImpasseProvenanceError('impasse sidecar corpus hash does not match the current corpus', {
        code: 'impasse_corpus_provenance_mismatch',
        details: {
          expected_content_hash: expected.content_hash,
          actual_content_hash: actual.content_hash || null,
          expected_item_count: expected.item_count,
          actual_item_count: actual.item_count ?? null,
        },
      }),
      expected,
      actual,
    };
  }

  const missingItemIds = corpus.episodes.map((episode) => episode.episode_id).filter((itemId) => !byId.has(itemId));
  if (missingItemIds.length) {
    return {
      status: 'mismatch',
      issue: new ImpasseProvenanceError(`impasse sidecar is missing corpus items: ${missingItemIds.join(', ')}`, {
        code: 'impasse_sidecar_item_set_mismatch',
        details: { missing_item_ids: missingItemIds },
      }),
      expected,
      actual,
    };
  }

  for (const episode of corpus.episodes) {
    const expectedItemHash = impasseEpisodeContentHash(episode);
    const actualItemHash = byId.get(episode.episode_id)?.[IMPASSE_ITEM_HASH_FIELD];
    if (actualItemHash !== expectedItemHash) {
      return {
        status: 'mismatch',
        issue: new ImpasseProvenanceError(
          `impasse sidecar item hash does not match the current corpus: ${episode.episode_id}`,
          {
            code: 'impasse_item_content_hash_mismatch',
            details: {
              item_id: episode.episode_id,
              expected_content_hash: expectedItemHash,
              actual_content_hash: actualItemHash || null,
            },
          },
        ),
        expected,
        actual,
      };
    }
  }
  return { status: 'current', issue: null, expected, actual, byId };
}

export function assertImpasseSidecarProvenance(sidecar, corpus, options = {}) {
  const inspection = inspectSidecar(sidecar, corpus, options);
  if (inspection.issue) throw inspection.issue;
  return inspection;
}

export function bindImpasseSidecarToCorpus(sidecar, corpus, { source = '', migratedAt = null } = {}) {
  validateImpasseCorpus(corpus);
  const byId = sidecarItems(sidecar);
  const knownIds = new Set(corpus.episodes.map((episode) => episode.episode_id));
  const unknownItemIds = [...byId.keys()].filter((itemId) => !knownIds.has(itemId));
  if (unknownItemIds.length) {
    throw new ImpasseProvenanceError(
      `impasse sidecar contains item ids absent from the corpus: ${unknownItemIds.join(', ')}`,
      {
        code: 'impasse_sidecar_unknown_items',
        details: { item_ids: unknownItemIds },
      },
    );
  }
  const priorSchema = sidecar.schema || null;
  return {
    ...sidecar,
    schema: IMPASSE_RATER_SCHEMA,
    source,
    corpus_provenance: buildImpasseCorpusProvenance(corpus, { source }),
    provenance_migration: {
      prior_schema: priorSchema,
      accepted_current_corpus: true,
      ...(migratedAt ? { migrated_at: migratedAt } : {}),
    },
    items: corpus.episodes.map((episode) => ({
      ...(byId.get(episode.episode_id) || { item_id: episode.episode_id }),
      item_id: episode.episode_id,
      [IMPASSE_ITEM_HASH_FIELD]: impasseEpisodeContentHash(episode),
    })),
  };
}

function writeJsonAtomic(filePath, value) {
  const tempPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, filePath);
}

function inspectFile(filePath, corpus, source) {
  let sidecar;
  try {
    sidecar = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return { path: filePath, status: 'invalid', code: 'invalid_impasse_sidecar', error: error.message };
  }
  const inspection = inspectSidecar(sidecar, corpus, { source });
  return {
    path: filePath,
    status: inspection.status,
    code: inspection.issue?.code || null,
    error: inspection.issue?.message || null,
    sidecar,
  };
}

function inspectImpasseProvenanceArtifactsInternal({
  sourcePath,
  source = path.resolve(sourcePath),
  outputDir,
  prefix,
}) {
  const corpus = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  validateImpasseCorpus(corpus);
  const files = fs.existsSync(outputDir)
    ? fs
        .readdirSync(outputDir)
        .filter((name) => name.startsWith(prefix) && name.endsWith('.json'))
        .sort()
        .map((name) => path.join(outputDir, name))
    : [];
  const entries = files.map((filePath) => inspectFile(filePath, corpus, source));
  return {
    schema: 'machinespirits.labelling-game.impasse-provenance-migration.v1',
    source_path: source,
    corpus_provenance: buildImpasseCorpusProvenance(corpus, { source }),
    entries: entries.map(({ sidecar: _sidecar, ...entry }) => entry),
    counts: Object.fromEntries(
      ['current', 'migration_required', 'mismatch', 'invalid'].map((status) => [
        status,
        entries.filter((entry) => entry.status === status).length,
      ]),
    ),
    _private: { corpus, entries },
  };
}

export function inspectImpasseProvenanceArtifacts(options) {
  const { _private: _private, ...report } = inspectImpasseProvenanceArtifactsInternal(options);
  return report;
}

export function migrateImpasseProvenanceArtifacts({
  sourcePath,
  source = path.resolve(sourcePath),
  outputDir,
  prefix,
  acceptCurrentCorpus = false,
} = {}) {
  const inspected = inspectImpasseProvenanceArtifactsInternal({ sourcePath, source, outputDir, prefix });
  const { corpus, entries } = inspected._private;
  const unresolved = entries.filter(
    (entry) => entry.status === 'invalid' || (entry.status !== 'current' && !acceptCurrentCorpus),
  );
  if (unresolved.length) {
    return {
      ...Object.fromEntries(Object.entries(inspected).filter(([key]) => key !== '_private')),
      success: false,
      migrated: [],
      unresolved: unresolved.map(({ sidecar: _sidecar, ...entry }) => entry),
    };
  }
  const migrated = [];
  const migratedAt = new Date().toISOString();
  for (const entry of entries) {
    if (entry.status === 'current') continue;
    const bound = bindImpasseSidecarToCorpus(entry.sidecar, corpus, {
      source,
      migratedAt,
    });
    writeJsonAtomic(entry.path, bound);
    migrated.push(entry.path);
  }
  const { _private: _private, ...report } = inspected;
  return { ...report, success: true, migrated, unresolved: [] };
}
