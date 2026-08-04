#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  DATA_ASSET_SCHEMA,
  appendRegistryRecord,
  assertCorpusTrainingAdmission,
  canonicalJson,
  inventoryDirectory,
  sealAssetDirectory,
  sha256,
  sha256File,
  validateApprovalRecord,
  validateAssetRecord,
  validateHoldoutRecord,
  verifyInventory,
} from '../services/dataGovernance.js';

function value(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function required(name) {
  const result = value(name);
  if (!result) throw new Error(`${name} is required`);
  return result;
}

function writeJson(filePath, valueToWrite) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(valueToWrite, null, 2)}\n`, { mode: 0o600 });
}

function logicalPath(logicalRoot, dataHome) {
  const prefix = 'MS_DATA_HOME/';
  if (!logicalRoot.startsWith(prefix)) throw new Error(`unsupported logical root: ${logicalRoot}`);
  const relative = logicalRoot.slice(prefix.length);
  if (!relative || relative.split('/').includes('..')) throw new Error(`unsafe logical root: ${logicalRoot}`);
  return path.join(dataHome, relative);
}

function main() {
  const command = process.argv[2];
  if (command === 'init') {
    const root = path.resolve(required('--root'));
    fs.mkdirSync(root, { recursive: true, mode: 0o700 });
    const created = [];
    for (const name of ['assets.jsonl', 'holdouts.jsonl', 'approvals.jsonl']) {
      const filePath = path.join(root, name);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '', { mode: 0o600 });
        created.push(name);
      }
    }
    console.log(JSON.stringify({ ok: true, root, created }));
    return;
  }
  if (command === 'seed-holdouts') {
    const seed = JSON.parse(fs.readFileSync(path.resolve(required('--seed')), 'utf8'));
    const registry = path.resolve(required('--registry'));
    const existingIds = new Set(
      fs.existsSync(registry)
        ? fs
            .readFileSync(registry, 'utf8')
            .split(/\r?\n/u)
            .filter(Boolean)
            .map((line) => JSON.parse(line).holdoutId)
        : [],
    );
    let appended = 0;
    for (const record of seed.records || []) {
      if (existingIds.has(record.holdoutId)) continue;
      appendRegistryRecord(registry, record, validateHoldoutRecord);
      appended += 1;
    }
    console.log(JSON.stringify({ ok: true, appended, registry }));
    return;
  }
  if (command === 'seed-program2-split-holdouts') {
    const splits = JSON.parse(fs.readFileSync(path.resolve(required('--splits')), 'utf8'));
    const registry = path.resolve(required('--registry'));
    const seed = {
      records: Object.entries(splits.byDialogue || {})
        .filter(([, split]) => split !== 'train')
        .map(([sourceGroupId, split]) => ({
          schema: 'machinespirits.data-governance.holdout-record.v1',
          holdoutId: `holdout-program2-v1-${split}-${sourceGroupId}`,
          action: 'holdout',
          recordedAt: '2026-08-04T00:00:00.000Z',
          reason: `Program-2 v1 ${split} dialogue is excluded from training and all descendants`,
          sourceGroupId,
        })),
    };
    const existingIds = new Set(
      fs.existsSync(registry)
        ? fs
            .readFileSync(registry, 'utf8')
            .split(/\r?\n/u)
            .filter(Boolean)
            .map((line) => JSON.parse(line).holdoutId)
        : [],
    );
    let appended = 0;
    for (const record of seed.records) {
      if (existingIds.has(record.holdoutId)) continue;
      appendRegistryRecord(registry, record, validateHoldoutRecord);
      appended += 1;
    }
    console.log(JSON.stringify({ ok: true, appended, registry }));
    return;
  }
  if (command === 'register-retrospective') {
    const dataHome = path.resolve(
      value('--data-home', process.env.MS_DATA_HOME || path.join(os.homedir(), '.machinespirits-data')),
    );
    const catalog = JSON.parse(fs.readFileSync(path.resolve(required('--catalog')), 'utf8'));
    const registry = path.resolve(required('--registry'));
    const existingIds = new Set(
      fs.existsSync(registry)
        ? fs
            .readFileSync(registry, 'utf8')
            .split(/\r?\n/u)
            .filter(Boolean)
            .map((line) => JSON.parse(line).assetId)
        : [],
    );
    let appended = 0;
    for (const asset of catalog.assets) {
      if (existingIds.has(asset.assetId)) continue;
      const locatorPaths = asset.logicalRoots || [asset.logicalRoot || asset.logicalFile].filter(Boolean);
      if (!locatorPaths.length) throw new Error(`catalog asset has no private locator: ${asset.assetId}`);
      const files = [];
      for (const [index, locator] of locatorPaths.entries()) {
        const resolved = logicalPath(locator, dataHome);
        if (!fs.existsSync(resolved)) throw new Error(`catalog asset is missing: ${asset.assetId}`);
        if (fs.statSync(resolved).isDirectory()) {
          const inventory = inventoryDirectory(resolved, { rootLabel: asset.assetId });
          files.push(
            ...inventory.files.map((entry) => ({
              ...entry,
              path: locatorPaths.length === 1 ? entry.path : `root-${index + 1}/${entry.path}`,
            })),
          );
        } else {
          files.push({
            path: path.basename(resolved),
            bytes: fs.statSync(resolved).size,
            sha256: sha256File(resolved),
          });
        }
      }
      const inventoryBase = { rootLabel: asset.assetId, files };
      const record = {
        schema: DATA_ASSET_SCHEMA,
        assetId: asset.assetId,
        kind: asset.kind,
        status: 'sealed',
        createdAt: new Date().toISOString(),
        sourceAssetIds: asset.sourceAssetIds || [],
        locator: { type: 'logical_data_home', paths: locatorPaths },
        inventory: { ...inventoryBase, inventorySha256: sha256(canonicalJson(inventoryBase)) },
        trainingStatus: asset.trainingRole,
        retentionClass: 'retain_while_evidence_or_model_depends_on_asset',
        replicationClass: asset.kind === 'candidate_dataset' ? 'private_archive' : 'private_evidence_replica',
        accessClass: 'private',
      };
      appendRegistryRecord(registry, record, validateAssetRecord);
      appended += 1;
    }
    console.log(JSON.stringify({ ok: true, appended, registry }));
    return;
  }
  if (command === 'inventory') {
    const root = path.resolve(required('--root'));
    const assetId = required('--asset-id');
    const record = {
      schema: DATA_ASSET_SCHEMA,
      assetId,
      kind: value('--kind', 'private_data_asset'),
      status: 'sealed',
      createdAt: new Date().toISOString(),
      sourceAssetIds: value('--source-assets', '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
      inventory: inventoryDirectory(root, { rootLabel: assetId }),
    };
    validateAssetRecord(record);
    const output = value('--out');
    if (output) writeJson(path.resolve(output), record);
    console.log(JSON.stringify(record, null, 2));
    return;
  }
  if (command === 'verify') {
    const record = JSON.parse(fs.readFileSync(path.resolve(required('--record')), 'utf8'));
    validateAssetRecord(record);
    if (!record.inventory) throw new Error('asset record has no inventory');
    verifyInventory(path.resolve(required('--root')), record.inventory);
    console.log(
      JSON.stringify({ ok: true, assetId: record.assetId, inventorySha256: record.inventory.inventorySha256 }),
    );
    return;
  }
  if (command === 'seal') {
    const seal = sealAssetDirectory({
      sourceDir: path.resolve(required('--source')),
      destinationDir: path.resolve(required('--destination')),
      assetId: required('--asset-id'),
      sourceAssetIds: value('--source-assets', '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
    });
    console.log(JSON.stringify(seal, null, 2));
    return;
  }
  if (command === 'append') {
    const type = required('--type');
    const validators = { asset: validateAssetRecord, holdout: validateHoldoutRecord, approval: validateApprovalRecord };
    if (!validators[type]) throw new Error('--type must be asset, holdout, or approval');
    const record = JSON.parse(fs.readFileSync(path.resolve(required('--record')), 'utf8'));
    appendRegistryRecord(path.resolve(required('--registry')), record, validators[type]);
    console.log(JSON.stringify({ ok: true, type, id: record.assetId || record.holdoutId || record.approvalId }));
    return;
  }
  if (command === 'admit') {
    const result = assertCorpusTrainingAdmission({
      manifestPath: path.resolve(required('--manifest')),
      approvalRegistryPath: path.resolve(required('--approvals')),
      holdoutRegistryPath: path.resolve(required('--holdouts')),
      purpose: required('--purpose'),
      model: required('--model'),
    });
    console.log(JSON.stringify({ ok: true, corpusId: result.manifest.corpusId, manifestSha256: result.manifestHash }));
    return;
  }
  if (command === 'audit-retrospective') {
    const dataHome = path.resolve(
      value('--data-home', process.env.MS_DATA_HOME || path.join(os.homedir(), '.machinespirits-data')),
    );
    const catalog = JSON.parse(fs.readFileSync(path.resolve(required('--catalog')), 'utf8'));
    const assets = catalog.assets.map((asset) => {
      if (asset.logicalFile) {
        const filePath = logicalPath(asset.logicalFile, dataHome);
        if (!fs.existsSync(filePath)) return { assetId: asset.assetId, status: 'missing' };
        const actualSha256 = sha256File(filePath);
        return {
          assetId: asset.assetId,
          status: asset.expectedSha256 && actualSha256 !== asset.expectedSha256 ? 'hash_mismatch' : 'verified',
          files: 1,
          sha256: actualSha256,
        };
      }
      const logicalRoots = asset.logicalRoots || (asset.logicalRoot ? [asset.logicalRoot] : []);
      if (!logicalRoots.length) return { assetId: asset.assetId, status: 'catalog_only' };
      const roots = logicalRoots.map((logicalRoot) => logicalPath(logicalRoot, dataHome));
      if (roots.some((root) => !fs.existsSync(root))) return { assetId: asset.assetId, status: 'missing' };
      const inventories = roots.map((root, index) =>
        inventoryDirectory(root, { rootLabel: `${asset.assetId}:${index + 1}` }),
      );
      const inventory = inventories[0];
      const expected = asset.expectedFiles || {};
      const mismatches = Object.entries(expected).filter(([name, hash]) => {
        const file = inventory.files.find((entry) => entry.path === name);
        return !file || file.sha256 !== hash;
      });
      return {
        assetId: asset.assetId,
        status: mismatches.length ? 'hash_mismatch' : 'verified',
        files: inventories.reduce((sum, entry) => sum + entry.files.length, 0),
        inventorySha256:
          inventories.length === 1
            ? inventory.inventorySha256
            : sha256(JSON.stringify(inventories.map((entry) => entry.inventorySha256))),
        expectedHashMismatches: mismatches.map(([name]) => name),
      };
    });
    console.log(JSON.stringify({ catalogId: catalog.catalogId, assets }, null, 2));
    if (assets.some((asset) => asset.status === 'hash_mismatch')) process.exitCode = 1;
    return;
  }
  throw new Error(
    'usage: data-governance.js init|seed-holdouts|seed-program2-split-holdouts|register-retrospective|inventory|verify|seal|append|admit|audit-retrospective',
  );
}

try {
  main();
} catch (error) {
  console.error(`data-governance: ${error.message}`);
  process.exitCode = 1;
}
