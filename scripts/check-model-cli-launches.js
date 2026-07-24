#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_MANIFEST = path.join(ROOT, 'config', 'model-cli-launch-manifest.json');
const SOURCE_ROOTS = ['services', 'scripts'];
const MODEL_BINARIES = new Set(['claude', 'codex', 'gemini', 'agy', 'ollama']);
const SUSPICIOUS_NAME = /(?:claude|codex|gemini|agy|ollama|model.*cli|cli.*(?:bin|binary|command|executable))/iu;

function walkFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(full));
    else if (/\.(?:js|mjs)$/u.test(entry.name)) files.push(full);
  }
  return files;
}

function walkAst(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent') continue;
    if (Array.isArray(value)) {
      for (const child of value) walkAst(child, visit);
    } else if (value && typeof value === 'object') {
      walkAst(value, visit);
    }
  }
}

function calleeName(callee) {
  if (callee?.type === 'Identifier') return callee.name;
  if (callee?.type === 'MemberExpression' && !callee.computed && callee.property?.type === 'Identifier') {
    const object = callee.object?.type === 'Identifier' ? callee.object.name : '';
    return object ? `${object}.${callee.property.name}` : callee.property.name;
  }
  return '';
}

function expressionName(node) {
  if (node?.type === 'Identifier') return node.name;
  if (node?.type === 'MemberExpression') {
    const property = node.computed ? node.property?.value : node.property?.name;
    return String(property || '');
  }
  return '';
}

function literalModelBinary(node) {
  return node?.type === 'Literal' && MODEL_BINARIES.has(String(node.value || '').toLowerCase());
}

function callTargetName(node) {
  if (node?.type !== 'CallExpression') return '';
  return calleeName(node.callee);
}

function referencesTaintedName(node, taintedNames) {
  if (!node || typeof node !== 'object') return false;
  if (node.type === 'Identifier' && taintedNames.has(node.name)) return true;
  if (node.type === 'MemberExpression') return referencesTaintedName(node.object, taintedNames);
  return false;
}

function modelLaunchCandidates(file) {
  const source = fs.readFileSync(file, 'utf8');
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true, allowHashBang: true });
  const taintedNames = new Set();
  walkAst(ast, (node) => {
    if (node.type !== 'VariableDeclarator' || node.id?.type !== 'Identifier') return;
    if (
      literalModelBinary(node.init) ||
      SUSPICIOUS_NAME.test(node.id.name) ||
      ['resolveModelCliExecutable', 'createModelCliLaunchPlan'].includes(callTargetName(node.init))
    ) {
      taintedNames.add(node.id.name);
    }
  });

  const candidates = [];
  walkAst(ast, (node) => {
    if (node.type !== 'CallExpression') return;
    const callee = calleeName(node.callee);
    if (!['spawn', 'spawnSync', 'spawnImpl', 'pty.spawn'].includes(callee)) return;
    const command = node.arguments?.[0];
    const commandName = expressionName(command);
    const sourceText = source.slice(node.start, node.end);
    const isModelLaunch =
      literalModelBinary(command) ||
      referencesTaintedName(command, taintedNames) ||
      taintedNames.has(commandName) ||
      SUSPICIOUS_NAME.test(commandName) ||
      /['"](?:claude|codex|gemini|agy|ollama)['"]/iu.test(sourceText);
    if (!isModelLaunch) return;
    candidates.push({
      file: path.relative(ROOT, file),
      line: node.loc.start.line,
      source: sourceText.split(/\r?\n/u)[0].trim(),
    });
  });
  return candidates;
}

function countOccurrences(source, anchor) {
  if (!anchor) return 0;
  return source.split(anchor).length - 1;
}

export function checkModelCliLaunchManifest(manifestPath = DEFAULT_MANIFEST) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.version !== 1 || !Array.isArray(manifest.launches)) {
    throw new Error('model CLI launch manifest must have version 1 and a launches array');
  }

  const manifestErrors = [];
  for (const entry of manifest.launches) {
    const file = path.join(ROOT, entry.file || '');
    if (!fs.existsSync(file)) {
      manifestErrors.push(`${entry.id}: missing file ${entry.file}`);
      continue;
    }
    const actual = countOccurrences(fs.readFileSync(file, 'utf8'), entry.anchor);
    if (actual !== entry.expectedOccurrences) {
      manifestErrors.push(`${entry.id}: expected ${entry.expectedOccurrences} occurrence(s), found ${actual}`);
    }
    if (!entry.classification || !entry.policy)
      manifestErrors.push(`${entry.id}: classification and policy are required`);
  }

  const candidates = SOURCE_ROOTS.flatMap((directory) => walkFiles(path.join(ROOT, directory))).flatMap((file) =>
    modelLaunchCandidates(file),
  );
  const unclassified = candidates.filter((candidate) => {
    const source = fs.readFileSync(path.join(ROOT, candidate.file), 'utf8');
    const line = source.split(/\r?\n/u)[candidate.line - 1] || '';
    return !manifest.launches.some((entry) => entry.file === candidate.file && line.includes(entry.anchor));
  });

  return { manifestErrors, unclassified, candidates, launchCount: manifest.launches.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkModelCliLaunchManifest(process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_MANIFEST);
  if (result.manifestErrors.length || result.unclassified.length) {
    for (const error of result.manifestErrors) console.error(`manifest: ${error}`);
    for (const launch of result.unclassified) {
      console.error(`unclassified: ${launch.file}:${launch.line}: ${launch.source}`);
    }
    process.exitCode = 1;
  } else {
    console.log(`model-cli-launches: ${result.candidates.length} direct launch(es), all classified`);
  }
}
