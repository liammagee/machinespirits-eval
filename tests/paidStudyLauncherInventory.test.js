import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { checkPaidStudyLauncherInventory } from '../scripts/check-paid-study-launcher-inventory.js';

test('repository paid-launcher inventory is complete', () => {
  const result = checkPaidStudyLauncherInventory();
  assert.deepEqual(result.issues, []);
  assert.equal(result.discovered.length, result.entries);
  assert.deepEqual(result.durableCounts, {
    referenceImplementation: 2,
    migrationRequired: 7,
    retireOrMigrate: 10,
  });
});

test('inventory ratchet catches a new paid launcher and invalid broad exemption', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'paid-launcher-inventory-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.mkdirSync(path.join(root, 'config'));
  fs.writeFileSync(path.join(root, 'scripts', 'run-new-study.js'), "const flag = '--accept-charges';\n");
  const inventoryPath = path.join(root, 'config', 'inventory.json');
  fs.writeFileSync(
    inventoryPath,
    `${JSON.stringify({
      policyEffectiveAfter: '2026-08-22',
      discoveryMarkers: ['--accept-charges'],
      durableMigration: { referenceImplementation: [], migrationRequired: [], retireOrMigrate: [] },
      launchers: [],
    })}\n`,
  );
  assert.deepEqual(checkPaidStudyLauncherInventory({ root, inventoryPath }).issues, [
    'paid launcher is not inventoried: scripts/run-new-study.js',
  ]);

  fs.writeFileSync(
    inventoryPath,
    `${JSON.stringify({
      policyEffectiveAfter: '2026-08-22',
      discoveryMarkers: ['--accept-charges'],
      durableMigration: {
        referenceImplementation: [],
        migrationRequired: [],
        retireOrMigrate: ['scripts/run-new-study.js'],
      },
      launchers: [
        {
          path: 'scripts/run-new-study.js',
          registered: '2026-08-28',
          disposition: 'pre_policy_exemption',
          reason: 'too broad',
        },
      ],
    })}\n`,
  );
  assert.deepEqual(checkPaidStudyLauncherInventory({ root, inventoryPath }).issues, [
    'scripts/run-new-study.js: post-policy launcher cannot use a pre-policy exemption',
  ]);
});

test('durable migration inventory is a complete, exclusive partition', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'paid-launcher-durable-inventory-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.mkdirSync(path.join(root, 'config'));
  fs.writeFileSync(
    path.join(root, 'scripts', 'run-new-study.js'),
    "import { admitPaidStudyLaunch } from '../services/paidStudyLaunchContract.js';\nconst flag = '--accept-charges';\nadmitPaidStudyLaunch({});\n",
  );
  const inventoryPath = path.join(root, 'config', 'inventory.json');
  const entry = {
    path: 'scripts/run-new-study.js',
    registered: '2026-08-28',
    disposition: 'shared_contract',
    reason: 'Uses shared launch admission but has not migrated its dispatch path.',
  };
  fs.writeFileSync(
    inventoryPath,
    `${JSON.stringify({
      policyEffectiveAfter: '2026-08-22',
      discoveryMarkers: ['--accept-charges'],
      durableMigration: { referenceImplementation: [], migrationRequired: [], retireOrMigrate: [] },
      launchers: [entry],
    })}\n`,
  );
  assert.deepEqual(checkPaidStudyLauncherInventory({ root, inventoryPath }).issues, [
    'paid launcher has no durable migration classification: scripts/run-new-study.js',
  ]);

  fs.writeFileSync(
    inventoryPath,
    `${JSON.stringify({
      policyEffectiveAfter: '2026-08-22',
      discoveryMarkers: ['--accept-charges'],
      durableMigration: {
        referenceImplementation: [],
        migrationRequired: ['scripts/run-new-study.js'],
        retireOrMigrate: ['scripts/run-new-study.js'],
      },
      launchers: [entry],
    })}\n`,
  );
  assert.deepEqual(checkPaidStudyLauncherInventory({ root, inventoryPath }).issues, [
    'paid launcher has multiple durable migration classifications: scripts/run-new-study.js',
  ]);
});
