#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_INVENTORY = path.join(ROOT, 'config', 'paid-study-launcher-inventory.json');
const SHARED_HELPER = 'paidStudyLaunchContract.js';
const ALLOWED_DISPOSITIONS = new Set(['shared_contract', 'pre_policy_exemption', 'historical_live_exemption']);
const DURABLE_REFERENCE = 'referenceImplementation';
const DURABLE_MIGRATION_REQUIRED = 'migrationRequired';
const DURABLE_RETIRE_OR_MIGRATE = 'retireOrMigrate';
const DURABLE_GROUPS = Object.freeze([DURABLE_REFERENCE, DURABLE_MIGRATION_REQUIRED, DURABLE_RETIRE_OR_MIGRATE]);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

export function checkPaidStudyLauncherInventory({ root = ROOT, inventoryPath = DEFAULT_INVENTORY } = {}) {
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  const markers = inventory.discoveryMarkers || [];
  const launchers = inventory.launchers || [];
  const durableMigration = inventory.durableMigration || {};
  const issues = [];
  const entries = new Map();
  for (const entry of launchers) {
    if (entries.has(entry.path)) issues.push(`duplicate inventory entry: ${entry.path}`);
    entries.set(entry.path, entry);
  }
  const discovered = walk(path.join(root, 'scripts'))
    .filter((file) => /^run-.*\.js$/u.test(path.basename(file)))
    .filter((file) => {
      const source = fs.readFileSync(file, 'utf8');
      return source.includes(SHARED_HELPER) || markers.some((marker) => source.includes(marker));
    })
    .map((file) => path.relative(root, file).split(path.sep).join('/'))
    .sort();

  for (const file of discovered) {
    if (!entries.has(file)) issues.push(`paid launcher is not inventoried: ${file}`);
  }
  for (const [file, entry] of entries) {
    const absolute = path.join(root, file);
    if (!fs.existsSync(absolute)) {
      issues.push(`inventoried paid launcher is missing: ${file}`);
      continue;
    }
    if (!ALLOWED_DISPOSITIONS.has(entry.disposition)) issues.push(`${file}: invalid disposition`);
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(entry.registered || '')) issues.push(`${file}: invalid registration date`);
    if (!String(entry.reason || '').trim()) issues.push(`${file}: exemption/adoption reason is required`);
    const source = fs.readFileSync(absolute, 'utf8');
    if (entry.disposition === 'shared_contract') {
      if (!source.includes(SHARED_HELPER) || !source.includes('admitPaidStudyLaunch(')) {
        issues.push(`${file}: shared-contract launcher does not call admitPaidStudyLaunch`);
      }
    } else if (entry.disposition === 'pre_policy_exemption') {
      if (entry.registered > inventory.policyEffectiveAfter) {
        issues.push(`${file}: post-policy launcher cannot use a pre-policy exemption`);
      }
    } else if (entry.disposition === 'historical_live_exemption') {
      if (!/sealed|completed|produced|served|live|run/iu.test(entry.reason || '')) {
        issues.push(`${file}: historical/live exemption must name its narrow run basis`);
      }
    }
  }

  const durableClassification = new Map();
  for (const group of DURABLE_GROUPS) {
    const files = durableMigration[group];
    if (!Array.isArray(files)) {
      issues.push(`durable migration inventory is missing ${group}`);
      continue;
    }
    for (const file of files) {
      if (durableClassification.has(file)) {
        issues.push(`paid launcher has multiple durable migration classifications: ${file}`);
      } else {
        durableClassification.set(file, group);
      }
      if (!entries.has(file)) issues.push(`durable migration inventory names an unknown launcher: ${file}`);
    }
  }
  for (const [file, entry] of entries) {
    const group = durableClassification.get(file);
    if (!group) {
      issues.push(`paid launcher has no durable migration classification: ${file}`);
      continue;
    }
    if (group === DURABLE_REFERENCE) {
      const source = fs.readFileSync(path.join(root, file), 'utf8');
      if (entry.disposition !== 'shared_contract' || !source.includes('durableAttemptJournal.js')) {
        issues.push(`${file}: durable reference must use shared admission and the durable attempt journal`);
      }
    } else if (group === DURABLE_MIGRATION_REQUIRED && entry.disposition !== 'shared_contract') {
      issues.push(`${file}: migrationRequired is reserved for shared-admission launchers`);
    } else if (group === DURABLE_RETIRE_OR_MIGRATE && entry.disposition === 'shared_contract') {
      issues.push(`${file}: shared-admission launcher cannot be classified retireOrMigrate`);
    }
  }
  return {
    discovered,
    entries: launchers.length,
    durableCounts: Object.fromEntries(DURABLE_GROUPS.map((group) => [group, durableMigration[group]?.length || 0])),
    issues,
  };
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const result = checkPaidStudyLauncherInventory();
  if (result.issues.length) {
    for (const issue of result.issues) process.stderr.write(`- ${issue}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`paid-study launcher inventory passed (${result.entries} launchers)\n`);
  }
}
