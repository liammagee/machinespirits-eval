#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CONFIG_PATH = path.join(REPO_ROOT, 'config/static-import-cycles.json');
const JAVASCRIPT_EXTENSIONS = new Set(['.js', '.mjs']);

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

export function extractStaticRelativeSpecifiers(source) {
  const specifiers = [];
  let statement = '';

  const capture = (candidate) => {
    const fromMatch = candidate.match(/\bfrom\s*(['"])(\.[^'"]+)\1/u);
    const sideEffectMatch = candidate.match(/^\s*import\s*(['"])(\.[^'"]+)\1/u);
    const match = fromMatch || sideEffectMatch;
    if (match) specifiers.push(match[2]);
  };

  for (const line of source.split(/\r?\n/u)) {
    if (!statement) {
      const startsImport = /^\s*import\b/u.test(line);
      const startsReExport = /^\s*export\s+(?:\*|\{)/u.test(line);
      if (!startsImport && !startsReExport) continue;
      statement = line;
    } else {
      statement += `\n${line}`;
    }

    if (statement.includes(';')) {
      capture(statement.slice(0, statement.indexOf(';') + 1));
      statement = '';
    }
  }

  if (statement) capture(statement);
  return [...new Set(specifiers)];
}

export function collectJavaScriptFiles({ repoRoot, roots, excludedDirectories = [] }) {
  const excluded = new Set(excludedDirectories);
  const files = [];

  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!excluded.has(entry.name)) walk(absolutePath);
      } else if (JAVASCRIPT_EXTENSIONS.has(path.extname(entry.name))) {
        files.push(path.resolve(absolutePath));
      }
    }
  };

  for (const root of roots) walk(path.resolve(repoRoot, root));
  return files.sort();
}

function resolveRelativeModule(importer, specifier, fileSet) {
  const cleanSpecifier = specifier.split(/[?#]/u, 1)[0];
  const base = path.resolve(path.dirname(importer), cleanSpecifier);
  const candidates = path.extname(base)
    ? [base]
    : [`${base}.js`, `${base}.mjs`, path.join(base, 'index.js'), path.join(base, 'index.mjs')];
  return candidates.find((candidate) => fileSet.has(candidate)) || null;
}

export function buildStaticImportGraph({ repoRoot, roots, excludedDirectories = [] }) {
  const files = collectJavaScriptFiles({ repoRoot, roots, excludedDirectories });
  const fileSet = new Set(files);
  const graph = new Map(files.map((file) => [file, []]));

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const specifier of extractStaticRelativeSpecifiers(source)) {
      const target = resolveRelativeModule(file, specifier, fileSet);
      if (target) graph.get(file).push(target);
    }
    graph.set(file, [...new Set(graph.get(file))].sort());
  }

  return graph;
}

export function findStronglyConnectedComponents(graph) {
  let nextIndex = 0;
  const indices = new Map();
  const lowLinks = new Map();
  const stack = [];
  const onStack = new Set();
  const components = [];

  const visit = (node) => {
    indices.set(node, nextIndex);
    lowLinks.set(node, nextIndex);
    nextIndex += 1;
    stack.push(node);
    onStack.add(node);

    for (const target of graph.get(node) || []) {
      if (!indices.has(target)) {
        visit(target);
        lowLinks.set(node, Math.min(lowLinks.get(node), lowLinks.get(target)));
      } else if (onStack.has(target)) {
        lowLinks.set(node, Math.min(lowLinks.get(node), indices.get(target)));
      }
    }

    if (lowLinks.get(node) !== indices.get(node)) return;

    const component = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      component.push(member);
    } while (member !== node);

    const selfCycle = component.length === 1 && (graph.get(component[0]) || []).includes(component[0]);
    if (component.length > 1 || selfCycle) components.push(component.sort());
  };

  for (const node of graph.keys()) {
    if (!indices.has(node)) visit(node);
  }

  return components.sort((left, right) => left.join('\n').localeCompare(right.join('\n')));
}

function normalizeCycles(cycles, repoRoot) {
  return cycles
    .map((component) => component.map((file) => toPosix(path.relative(repoRoot, file))).sort())
    .sort((left, right) => left.join('\n').localeCompare(right.join('\n')));
}

export function checkStaticImportCycles({ repoRoot = REPO_ROOT, configPath = DEFAULT_CONFIG_PATH } = {}) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const graph = buildStaticImportGraph({
    repoRoot,
    roots: config.roots,
    excludedDirectories: config.excludedDirectories,
  });
  const actualCycles = normalizeCycles(findStronglyConnectedComponents(graph), repoRoot);
  const expectedCycles = config.expectedCycles
    .map((component) => [...component].sort())
    .sort((left, right) => left.join('\n').localeCompare(right.join('\n')));

  return {
    ok: JSON.stringify(actualCycles) === JSON.stringify(expectedCycles),
    actualCycles,
    expectedCycles,
    scannedFiles: graph.size,
  };
}

function renderCycles(cycles) {
  if (!cycles.length) return '  (none)';
  return cycles.map((component) => `  - ${component.join(' -> ')}`).join('\n');
}

function main() {
  const result = checkStaticImportCycles();
  if (!result.ok) {
    console.error('[static-import-cycles] cycle baseline changed');
    console.error('Expected:');
    console.error(renderCycles(result.expectedCycles));
    console.error('Actual:');
    console.error(renderCycles(result.actualCycles));
    process.exitCode = 1;
    return;
  }

  console.log(
    `[static-import-cycles] ${result.actualCycles.length} expected cycle across ${result.scannedFiles} files`,
  );
  console.log(renderCycles(result.actualCycles));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
