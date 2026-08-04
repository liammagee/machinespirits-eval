import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const DATA_ASSET_SCHEMA = 'machinespirits.data-governance.asset-record.v1';
export const DATA_HOLDOUT_SCHEMA = 'machinespirits.data-governance.holdout-record.v1';
export const DATA_APPROVAL_SCHEMA = 'machinespirits.data-governance.approval-record.v1';
export const DATA_CORPUS_SCHEMA = 'machinespirits.data-governance.corpus-manifest.v1';
export const DATA_SEAL_SCHEMA = 'machinespirits.data-governance.sealed-asset.v1';

const SHA256_RE = /^[a-f0-9]{64}$/u;

function isObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sorted(value[key])]),
  );
}

export function canonicalJson(value) {
  return JSON.stringify(sorted(value));
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

export function readJsonl(filePath, { allowMissing = false } = {}) {
  if (!fs.existsSync(filePath)) {
    if (allowMissing) return [];
    throw new Error(`registry not found: ${filePath}`);
  }
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${filePath}:${index + 1}: invalid JSON: ${error.message}`);
      }
    });
}

export function appendRegistryRecord(filePath, record, validate) {
  if (validate) validate(record);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(record)}\n`, { encoding: 'utf8', mode: 0o600 });
}

function requireString(record, key, label) {
  if (typeof record?.[key] !== 'string' || !record[key].trim()) {
    throw new Error(`${label}.${key} must be a non-empty string`);
  }
}

function requireSchema(record, schema, label) {
  if (!isObject(record) || record.schema !== schema) {
    throw new Error(`${label}.schema must be ${schema}`);
  }
}

function requireRelativeFileEntries(entries, label) {
  if (!Array.isArray(entries)) throw new Error(`${label} must be an array`);
  for (const [index, entry] of entries.entries()) {
    requireString(entry, 'path', `${label}[${index}]`);
    if (path.isAbsolute(entry.path) || entry.path.split(/[\\/]/u).includes('..')) {
      throw new Error(`${label}[${index}].path must be relative and contained`);
    }
    if (!Number.isInteger(entry.bytes) || entry.bytes < 0) {
      throw new Error(`${label}[${index}].bytes must be a non-negative integer`);
    }
    if (!SHA256_RE.test(entry.sha256 || '')) {
      throw new Error(`${label}[${index}].sha256 must be a lowercase SHA-256`);
    }
  }
}

export function validateAssetRecord(record) {
  requireSchema(record, DATA_ASSET_SCHEMA, 'asset');
  for (const key of ['assetId', 'kind', 'status', 'createdAt']) requireString(record, key, 'asset');
  if (!Array.isArray(record.sourceAssetIds)) throw new Error('asset.sourceAssetIds must be an array');
  if (record.inventory) {
    requireString(record.inventory, 'rootLabel', 'asset.inventory');
    requireRelativeFileEntries(record.inventory.files, 'asset.inventory.files');
  }
  if (record.locator) {
    if (record.locator.type !== 'logical_data_home' || !Array.isArray(record.locator.paths)) {
      throw new Error('asset.locator must use logical_data_home paths');
    }
    for (const locatorPath of record.locator.paths) {
      if (!String(locatorPath).startsWith('MS_DATA_HOME/') || String(locatorPath).includes('..')) {
        throw new Error('asset.locator paths must be contained MS_DATA_HOME paths');
      }
    }
  }
  return record;
}

export function validateHoldoutRecord(record) {
  requireSchema(record, DATA_HOLDOUT_SCHEMA, 'holdout');
  for (const key of ['holdoutId', 'action', 'recordedAt', 'reason']) requireString(record, key, 'holdout');
  if (!['holdout', 'release'].includes(record.action)) throw new Error('holdout.action must be holdout or release');
  if (!record.assetId && !record.sourceGroupId) {
    throw new Error('holdout must name assetId or sourceGroupId');
  }
  return record;
}

export function validateApprovalRecord(record) {
  requireSchema(record, DATA_APPROVAL_SCHEMA, 'approval');
  for (const key of ['approvalId', 'corpusId', 'corpusManifestSha256', 'status', 'recordedAt', 'approver']) {
    requireString(record, key, 'approval');
  }
  if (!SHA256_RE.test(record.corpusManifestSha256)) {
    throw new Error('approval.corpusManifestSha256 must be a lowercase SHA-256');
  }
  if (!['approved', 'revoked'].includes(record.status)) {
    throw new Error('approval.status must be approved or revoked');
  }
  if (!Array.isArray(record.purposes) || !record.purposes.length) {
    throw new Error('approval.purposes must be a non-empty array');
  }
  if (!Array.isArray(record.models) || !record.models.length) {
    throw new Error('approval.models must be a non-empty array');
  }
  return record;
}

export function validateCorpusManifest(record) {
  requireSchema(record, DATA_CORPUS_SCHEMA, 'corpus');
  for (const key of ['corpusId', 'createdAt', 'trainingStatus']) requireString(record, key, 'corpus');
  if (!['candidate', 'training_approved'].includes(record.trainingStatus)) {
    throw new Error('corpus.trainingStatus must be candidate or training_approved');
  }
  if (!Array.isArray(record.sourceAssetIds) || !record.sourceAssetIds.length) {
    throw new Error('corpus.sourceAssetIds must be a non-empty array');
  }
  if (!Array.isArray(record.sourceGroupIds)) throw new Error('corpus.sourceGroupIds must be an array');
  requireRelativeFileEntries(record.files, 'corpus.files');
  if (!isObject(record.splitPolicy) || record.splitPolicy.groupedBy !== 'source_group') {
    throw new Error('corpus.splitPolicy.groupedBy must be source_group');
  }
  return record;
}

function walkFiles(rootDir, currentDir, output) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (entry.name === '.machinespirits-asset.json') continue;
    const absolute = path.join(currentDir, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`symbolic links are not sealable: ${absolute}`);
    if (entry.isDirectory()) {
      walkFiles(rootDir, absolute, output);
      continue;
    }
    if (!entry.isFile()) throw new Error(`unsupported asset entry: ${absolute}`);
    const relative = path.relative(rootDir, absolute).split(path.sep).join('/');
    const stat = fs.statSync(absolute);
    output.push({ path: relative, bytes: stat.size, sha256: sha256File(absolute) });
  }
}

export function inventoryDirectory(rootDir, { rootLabel = path.basename(rootDir) } = {}) {
  const resolved = path.resolve(rootDir);
  if (!fs.statSync(resolved).isDirectory()) throw new Error(`asset root is not a directory: ${resolved}`);
  const files = [];
  walkFiles(resolved, resolved, files);
  const inventory = { rootLabel, files };
  return { ...inventory, inventorySha256: sha256(canonicalJson(inventory)) };
}

export function verifyInventory(rootDir, inventory) {
  requireString(inventory, 'rootLabel', 'inventory');
  requireRelativeFileEntries(inventory.files, 'inventory.files');
  const actual = inventoryDirectory(rootDir, { rootLabel: inventory.rootLabel });
  const expectedHash =
    inventory.inventorySha256 ||
    sha256(
      canonicalJson({
        rootLabel: inventory.rootLabel,
        files: inventory.files,
      }),
    );
  if (actual.inventorySha256 !== expectedHash) {
    throw new Error(`inventory mismatch: expected ${expectedHash}, found ${actual.inventorySha256}`);
  }
  return actual;
}

export function sealAssetDirectory({ sourceDir, destinationDir, assetId, sourceAssetIds = [] }) {
  if (!assetId) throw new Error('assetId is required');
  const sourceInventory = inventoryDirectory(sourceDir, { rootLabel: assetId });
  const destination = path.resolve(destinationDir);
  if (fs.existsSync(destination)) throw new Error(`seal destination already exists: ${destination}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const staging = fs.mkdtempSync(path.join(path.dirname(destination), `.${path.basename(destination)}-staging-`));
  try {
    fs.cpSync(sourceDir, staging, { recursive: true, dereference: false, errorOnExist: true });
    verifyInventory(staging, sourceInventory);
    const seal = {
      schema: DATA_SEAL_SCHEMA,
      assetId,
      sourceAssetIds,
      sealedAt: new Date().toISOString(),
      inventory: sourceInventory,
    };
    fs.writeFileSync(path.join(staging, '.machinespirits-asset.json'), `${JSON.stringify(seal, null, 2)}\n`, {
      mode: 0o600,
    });
    fs.renameSync(staging, destination);
    return seal;
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true });
    throw error;
  }
}

function activeHoldoutSelectors(records) {
  const selectors = new Map();
  for (const record of records) {
    validateHoldoutRecord(record);
    const key = record.assetId ? `asset:${record.assetId}` : `group:${record.sourceGroupId}`;
    selectors.set(key, record);
  }
  return selectors;
}

export function assertCorpusTrainingAdmission({
  manifestPath,
  approvalRegistryPath,
  holdoutRegistryPath,
  purpose,
  model,
  now = new Date(),
}) {
  if (!manifestPath || !approvalRegistryPath || !holdoutRegistryPath || !purpose || !model) {
    throw new Error('manifest, approval registry, holdout registry, purpose, and model are required');
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  validateCorpusManifest(manifest);
  if (manifest.trainingStatus !== 'training_approved') {
    throw new Error(`corpus ${manifest.corpusId} is not training_approved`);
  }
  const manifestHash = sha256File(manifestPath);
  const approvals = readJsonl(approvalRegistryPath).map(validateApprovalRecord);
  const matching = approvals.filter(
    (entry) => entry.corpusId === manifest.corpusId && entry.corpusManifestSha256 === manifestHash,
  );
  const approval = matching.at(-1);
  if (!approval || approval.status !== 'approved') throw new Error('no active approval for the exact corpus manifest');
  if (!approval.purposes.includes(purpose)) throw new Error(`approval does not permit purpose ${purpose}`);
  if (!approval.models.includes(model)) throw new Error(`approval does not permit model ${model}`);
  if (approval.expiresAt && new Date(approval.expiresAt) <= now) throw new Error('corpus approval has expired');

  const holdouts = activeHoldoutSelectors(readJsonl(holdoutRegistryPath));
  for (const assetId of manifest.sourceAssetIds) {
    if (holdouts.get(`asset:${assetId}`)?.action === 'holdout') throw new Error(`source asset is held out: ${assetId}`);
  }
  for (const groupId of manifest.sourceGroupIds) {
    if (holdouts.get(`group:${groupId}`)?.action === 'holdout') throw new Error(`source group is held out: ${groupId}`);
  }

  const manifestDir = path.dirname(path.resolve(manifestPath));
  for (const file of manifest.files) {
    const absolute = path.resolve(manifestDir, file.path);
    if (!absolute.startsWith(`${manifestDir}${path.sep}`))
      throw new Error(`corpus file escapes manifest root: ${file.path}`);
    if (!fs.existsSync(absolute)) throw new Error(`corpus file not found: ${file.path}`);
    const stat = fs.statSync(absolute);
    if (stat.size !== file.bytes || sha256File(absolute) !== file.sha256) {
      throw new Error(`corpus file integrity mismatch: ${file.path}`);
    }
  }
  return { manifest, manifestHash, approval };
}
