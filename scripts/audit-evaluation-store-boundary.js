#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(__filename), '..');
const DEFAULT_INVENTORY_PATH = path.join(ROOT_DIR, 'config', 'evaluation-store-boundary-inventory.json');

function trackedSourceFiles(rootDir) {
  const output = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: rootDir,
    encoding: 'utf8',
  });

  return output
    .split('\0')
    .filter(Boolean)
    .filter((file) => /\.(?:cjs|js|mjs|ts)$/.test(file));
}

function importModes(source) {
  const modes = new Set();
  const target = String.raw`[^'"\n]*evaluationStore\.js`;

  if (new RegExp(String.raw`export\s+\*\s+as\s+\w+\s+from\s+['"]${target}['"]`).test(source)) {
    modes.add('namespace-reexport');
  }
  if (new RegExp(String.raw`import\s+\*\s+as\s+\w+\s+from\s+['"]${target}['"]`).test(source)) {
    modes.add('namespace');
  }
  if (new RegExp(String.raw`import\s+[A-Za-z_$][\w$]*\s+from\s+['"]${target}['"]`).test(source)) {
    modes.add('default');
  }
  if (new RegExp(String.raw`import\s*\{[\s\S]{0,1200}?\}\s*from\s+['"]${target}['"]`).test(source)) {
    modes.add('named');
  }
  if (new RegExp(String.raw`import\s*\(\s*['"]${target}['"]\s*\)`).test(source)) {
    modes.add('dynamic');
  }

  return [...modes].sort();
}

function classifyConsumer(file) {
  if (file === 'index.js') return 'package-entrypoint';
  if (file.startsWith('scripts/archive/')) return 'archived-oneoff';
  if (file.startsWith('tests/') || file.includes('/__tests__/')) return 'test';
  if (file.startsWith('scripts/')) return 'operational-script';
  if (file.startsWith('routes/') || file.startsWith('services/')) return 'application-runtime';
  return 'other';
}

export function scanEvaluationStoreConsumers(rootDir = ROOT_DIR) {
  const consumers = [];

  for (const file of trackedSourceFiles(rootDir)) {
    const source = fs.readFileSync(path.join(rootDir, file), 'utf8');
    if (!source.includes('evaluationStore.js')) continue;

    const modes = importModes(source);
    if (modes.length === 0) continue;
    consumers.push({ path: file, classification: classifyConsumer(file), modes });
  }

  return consumers.sort((a, b) => a.path.localeCompare(b.path));
}

export function scanEvaluationStoreExports(rootDir = ROOT_DIR) {
  const source = fs.readFileSync(path.join(rootDir, 'services', 'evaluationStore.js'), 'utf8');
  const named = [...source.matchAll(/^export (?:async )?function ([A-Za-z_$][\w$]*)/gm)]
    .map((match) => match[1])
    .sort();
  const defaultBlock = source.match(/export default \{([\s\S]*?)\n\};/);
  if (!defaultBlock) throw new Error('evaluationStore default export object was not found');
  const defaultMembers = [...defaultBlock[1].matchAll(/^\s*([A-Za-z_$][\w$]*),/gm)].map((match) => match[1]).sort();

  return { named, defaultMembers };
}

export function buildActualInventory(rootDir = ROOT_DIR) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const indexSource = fs.readFileSync(path.join(rootDir, 'index.js'), 'utf8');

  return {
    consumers: scanEvaluationStoreConsumers(rootDir),
    exports: scanEvaluationStoreExports(rootDir),
    packageSurface: {
      root: packageJson.exports?.['.'] ?? null,
      servicesPattern: packageJson.exports?.['./services/*'] ?? null,
      rootNamespaceReexport:
        /export\s+\*\s+as\s+evaluationStore\s+from\s+['"]\.\/services\/evaluationStore\.js['"]/.test(indexSource),
    },
  };
}

function stable(value) {
  return JSON.stringify(value, null, 2);
}

export function auditEvaluationStoreBoundary({ rootDir = ROOT_DIR, inventoryPath = DEFAULT_INVENTORY_PATH } = {}) {
  const expected = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  const actual = buildActualInventory(rootDir);
  const expectedBoundary = {
    consumers: expected.consumers,
    exports: expected.exports,
    packageSurface: expected.packageSurface,
  };

  if (stable(actual) !== stable(expectedBoundary)) {
    return {
      ok: false,
      expected: expectedBoundary,
      actual,
    };
  }

  return { ok: true, actual };
}

function printSummary(inventory) {
  const counts = Object.create(null);
  for (const consumer of inventory.consumers) {
    counts[consumer.classification] = (counts[consumer.classification] ?? 0) + 1;
  }
  const liveCount = inventory.consumers.filter(
    (consumer) => !['archived-oneoff', 'test'].includes(consumer.classification),
  ).length;

  console.log('Evaluation store boundary inventory: current');
  console.log(`  tracked consumers: ${inventory.consumers.length} (${liveCount} live/package)`);
  for (const [classification, count] of Object.entries(counts).sort()) {
    console.log(`  ${classification}: ${count}`);
  }
  console.log(`  named exports: ${inventory.exports.named.length}`);
  console.log(`  default members: ${inventory.exports.defaultMembers.length}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMain) {
  const json = process.argv.includes('--json');
  const actualOnly = process.argv.includes('--actual');

  if (actualOnly) {
    const actual = buildActualInventory();
    console.log(stable(actual));
  } else {
    const result = auditEvaluationStoreBoundary();
    if (!result.ok) {
      console.error('Evaluation store boundary inventory drifted.');
      console.error(stable(result));
      process.exitCode = 1;
    } else if (json) {
      console.log(stable(result.actual));
    } else {
      printSummary(result.actual);
    }
  }
}
