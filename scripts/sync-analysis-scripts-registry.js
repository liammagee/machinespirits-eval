#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ANALYSIS_REGISTRY_RELATIVE_PATH = 'scripts/analysis-scripts-registry.json';
export const ANALYSIS_DOC_RELATIVE_PATH = 'scripts/ANALYSIS-SCRIPTS.md';
export const ANALYSIS_SCRIPT_PATTERN = /^analyze-[^/]+\.(?:cjs|js|mjs|ts)$/u;

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export class AnalysisRegistryError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'AnalysisRegistryError';
    this.details = details;
  }
}

function compare(left, right) {
  return left === right ? 0 : left < right ? -1 : 1;
}

function listDifference(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => !rightSet.has(value));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

export function discoverAnalysisScripts(projectRoot = PROJECT_ROOT) {
  const scriptsDir = path.join(projectRoot, 'scripts');
  return fs
    .readdirSync(scriptsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && ANALYSIS_SCRIPT_PATTERN.test(entry.name))
    .map((entry) => `scripts/${entry.name}`)
    .sort(compare);
}

export function loadAnalysisRegistry(projectRoot = PROJECT_ROOT) {
  const registryPath = path.join(projectRoot, ANALYSIS_REGISTRY_RELATIVE_PATH);
  return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
}

function sourceSupportsFlag(source, flag) {
  if (source.includes(flag)) return true;
  const name = flag.slice(2);
  const quoted = `['"]${escapeRegExp(name)}['"]`;
  const identifier = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/u.test(name) ? escapeRegExp(name) : null;
  const patterns = [
    new RegExp(`(?:value|flag|args|getOption|hasFlag)\\(\\s*${quoted}`, 'u'),
    new RegExp(`(?:arg|has)\\(\\s*[^,]+,\\s*${quoted}`, 'u'),
    new RegExp(`(?:args|values|options)\\[\\s*${quoted}\\s*\\]`, 'u'),
    new RegExp(`${quoted}\\s*:`, 'u'),
  ];
  if (identifier) {
    patterns.push(new RegExp(`(?:args|values|options)\\.${identifier}\\b`, 'u'));
    patterns.push(new RegExp(`\\b${identifier}\\s*:\\s*\\{\\s*type\\s*:`, 'u'));
  }
  return patterns.some((pattern) => pattern.test(source));
}

export function validateAnalysisRegistry(registry, projectRoot = PROJECT_ROOT) {
  const errors = [];
  if (registry?.version !== 1) errors.push('registry version must be 1');
  if (!Array.isArray(registry?.families) || registry.families.length === 0) {
    errors.push('registry families must be a non-empty array');
  }
  if (!Array.isArray(registry?.scripts)) errors.push('registry scripts must be an array');
  if (errors.length) return { errors, inventory: discoverAnalysisScripts(projectRoot) };

  const familyIds = registry.families.map((family) => family.id);
  if (new Set(familyIds).size !== familyIds.length) errors.push('registry family ids must be unique');
  for (const family of registry.families) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(String(family.id || ''))) {
      errors.push(`invalid family id: ${JSON.stringify(family.id)}`);
    }
    if (!String(family.title || '').trim() || /[\r\n]/u.test(String(family.title || ''))) {
      errors.push(`family ${family.id || '<missing>'} needs a one-line title`);
    }
  }

  const inventory = discoverAnalysisScripts(projectRoot);
  const registeredPaths = registry.scripts.map((entry) => entry.path);
  if (new Set(registeredPaths).size !== registeredPaths.length) errors.push('registry script paths must be unique');
  const missing = listDifference(inventory, registeredPaths);
  const extra = listDifference(registeredPaths, inventory);
  for (const file of missing) errors.push(`on disk but unregistered: ${file}`);
  for (const file of extra) errors.push(`registered but not on disk: ${file}`);

  const expectedOrder = [...registeredPaths].sort(compare);
  if (JSON.stringify(registeredPaths) !== JSON.stringify(expectedOrder)) {
    errors.push('registry scripts must be sorted by path');
  }

  const knownFamilies = new Set(familyIds);
  for (const entry of registry.scripts) {
    const label = entry.path || '<missing path>';
    if (!ANALYSIS_SCRIPT_PATTERN.test(path.basename(String(entry.path || '')))) {
      errors.push(`${label}: path must name a scripts/analyze-* source file`);
    }
    if (!knownFamilies.has(entry.family)) errors.push(`${label}: unknown family ${JSON.stringify(entry.family)}`);
    if (!String(entry.purpose || '').trim() || /[\r\n]/u.test(String(entry.purpose || ''))) {
      errors.push(`${label}: purpose must be one non-empty line`);
    }
    if (!Array.isArray(entry.flags)) {
      errors.push(`${label}: flags must be an array`);
      continue;
    }
    if (new Set(entry.flags).size !== entry.flags.length) errors.push(`${label}: flags must be unique`);
    const sortedFlags = [...entry.flags].sort(compare);
    if (JSON.stringify(entry.flags) !== JSON.stringify(sortedFlags)) errors.push(`${label}: flags must be sorted`);
    if (entry.frozen != null && typeof entry.frozen !== 'boolean') errors.push(`${label}: frozen must be boolean`);

    const sourcePath = path.join(projectRoot, String(entry.path || ''));
    if (!fs.existsSync(sourcePath)) continue;
    if (entry.flagEvidence != null && !Array.isArray(entry.flagEvidence)) {
      errors.push(`${label}: flagEvidence must be an array of repository-relative source or test paths`);
    }
    const flagEvidence = Array.isArray(entry.flagEvidence) ? entry.flagEvidence : [];
    const evidenceSources = [fs.readFileSync(sourcePath, 'utf8')];
    for (const evidencePath of flagEvidence) {
      const absoluteEvidencePath = path.resolve(projectRoot, String(evidencePath));
      const relativeEvidencePath = path.relative(projectRoot, absoluteEvidencePath);
      if (
        !String(evidencePath).trim() ||
        relativeEvidencePath.startsWith('..') ||
        path.isAbsolute(relativeEvidencePath) ||
        !fs.existsSync(absoluteEvidencePath) ||
        !fs.statSync(absoluteEvidencePath).isFile()
      ) {
        errors.push(`${label}: invalid flagEvidence path ${JSON.stringify(evidencePath)}`);
        continue;
      }
      evidenceSources.push(fs.readFileSync(absoluteEvidencePath, 'utf8'));
    }
    for (const flag of entry.flags) {
      if (!/^--[a-z][a-z0-9-]*$/u.test(flag)) {
        errors.push(`${label}: invalid flag ${JSON.stringify(flag)}`);
      } else if (!evidenceSources.some((source) => sourceSupportsFlag(source, flag))) {
        errors.push(`${label}: flag ${flag} has no parser or usage evidence in source`);
      }
    }
  }

  return { errors, inventory };
}

function renderFlags(flags) {
  return flags.length ? flags.map((flag) => `\`${flag}\``).join(' ') : '—';
}

export function renderAnalysisRegistry(registry) {
  const lines = [
    '# Analysis Scripts Registry',
    '',
    '<!-- Generated by scripts/sync-analysis-scripts-registry.js. Edit analysis-scripts-registry.json, then run with --write. -->',
    '',
    `All ${registry.scripts.length} live post-hoc \`scripts/analyze-*\` scripts, grouped by study family.`,
    "Purposes and supported flags are curated from each script's source and tests; the sync check verifies inventory coverage and flag evidence.",
    '“Frozen” means the source identifies the analysis or instrument as pre-registered, frozen, or bound to immutable study artifacts. Registration does not edit those scripts.',
    '',
    'Check drift with `node scripts/sync-analysis-scripts-registry.js --check`; regenerate with `node scripts/sync-analysis-scripts-registry.js --write`.',
    '',
  ];

  for (const family of registry.families) {
    const entries = registry.scripts
      .filter((entry) => entry.family === family.id)
      .sort((a, b) => compare(a.path, b.path));
    lines.push(`## ${family.title}`, '');
    lines.push('| Script | Supported flags | Purpose | Frozen |');
    lines.push('|---|---|---|:---:|');
    for (const entry of entries) {
      const basename = path.basename(entry.path);
      lines.push(
        `| [\`${basename}\`](./${basename}) | ${renderFlags(entry.flags)} | ${entry.purpose} | ${entry.frozen ? 'Yes' : 'No'} |`,
      );
    }
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

export function synchronizeAnalysisRegistry({ projectRoot = PROJECT_ROOT, mode = 'check' } = {}) {
  if (!['check', 'write'].includes(mode)) throw new Error(`unknown analysis registry sync mode: ${mode}`);
  const registry = loadAnalysisRegistry(projectRoot);
  const validation = validateAnalysisRegistry(registry, projectRoot);
  if (validation.errors.length) {
    throw new AnalysisRegistryError('Analysis scripts registry metadata is invalid.', validation.errors);
  }

  const docPath = path.join(projectRoot, ANALYSIS_DOC_RELATIVE_PATH);
  const expected = renderAnalysisRegistry(registry);
  const current = fs.existsSync(docPath) ? fs.readFileSync(docPath, 'utf8') : '';
  const changed = current !== expected;
  if (mode === 'check' && changed) {
    throw new AnalysisRegistryError('Analysis scripts registry documentation is out of date.', [
      `run \`node scripts/sync-analysis-scripts-registry.js --write\` to refresh ${ANALYSIS_DOC_RELATIVE_PATH}`,
    ]);
  }
  if (mode === 'write' && changed) fs.writeFileSync(docPath, expected);
  return { changed, count: validation.inventory.length, docPath };
}

export function runAnalysisRegistrySync(argv = process.argv.slice(2), projectRoot = PROJECT_ROOT) {
  if (argv.length !== 1 || !['--check', '--write'].includes(argv[0])) {
    throw new Error('Usage: node scripts/sync-analysis-scripts-registry.js [--check|--write]');
  }
  const mode = argv[0].slice(2);
  const result = synchronizeAnalysisRegistry({ projectRoot, mode });
  const action = mode === 'write' && result.changed ? 'updated' : 'verified';
  process.stdout.write(`Analysis scripts registry ${action}: ${result.count} scripts.\n`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    runAnalysisRegistrySync();
  } catch (error) {
    console.error(error.message);
    for (const detail of error.details || []) console.error(`- ${detail}`);
    process.exitCode = 1;
  }
}
