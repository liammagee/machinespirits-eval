#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'acorn';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FULL_STORE_MODULE = /\/services\/evaluationStore(?:\.js|\/createEvaluationStore\.js|\/lifecycle\.js)$/u;

function walkAst(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const child of value) walkAst(child, visit);
    } else if (value && typeof value === 'object') {
      walkAst(value, visit);
    }
  }
}

function literalString(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0]?.value?.cooked;
  return null;
}

function propertyName(node) {
  if (node?.type === 'Identifier') return node.name;
  return literalString(node);
}

export function analyzeTestStoreOwnership(source, file = '<source>') {
  const ast = parse(source, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    locations: true,
    allowHashBang: true,
  });
  let opensStore = false;
  let ownsDatabasePath = false;
  let ownsLogsPath = false;
  let usesMemoryDatabase = false;

  walkAst(ast, (node) => {
    if (node.type === 'ImportDeclaration' && FULL_STORE_MODULE.test(String(node.source?.value || ''))) {
      opensStore = true;
    }
    if (node.type === 'ImportExpression' && FULL_STORE_MODULE.test(String(literalString(node.source) || ''))) {
      opensStore = true;
    }
    if (node.type === 'CallExpression' && node.callee?.type === 'Identifier') {
      if (
        ['createEvaluationStore', 'startDefaultEvaluationStore', 'getDefaultEvaluationStore'].includes(node.callee.name)
      ) {
        opensStore = true;
      }
    }
    if (node.type === 'Identifier' || node.type === 'Literal') {
      const name = propertyName(node);
      if (name === 'EVAL_DB_PATH') ownsDatabasePath = true;
      if (name === 'EVAL_LOGS_DIR') ownsLogsPath = true;
      if (name === ':memory:') usesMemoryDatabase = true;
    }
  });

  return {
    file,
    opensStore,
    ownsDatabasePath,
    ownsLogsPath,
    usesMemoryDatabase,
    isolated: !opensStore || usesMemoryDatabase || (ownsDatabasePath && ownsLogsPath),
  };
}

export function checkTestStorePaths(rootDir = ROOT) {
  const testsDir = path.join(rootDir, 'tests');
  const analyses = fs
    .readdirSync(testsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.test.js'))
    .map((entry) => {
      const relative = path.posix.join('tests', entry.name);
      return analyzeTestStoreOwnership(fs.readFileSync(path.join(testsDir, entry.name), 'utf8'), relative);
    });
  return {
    analyses,
    storeOpening: analyses.filter((analysis) => analysis.opensStore),
    offenders: analyses.filter((analysis) => analysis.opensStore && !analysis.isolated),
  };
}

export function formatTestStorePathErrors(result) {
  return result.offenders.map(
    (offender) =>
      `${offender.file} opens the evaluation store without owning both EVAL_DB_PATH and EVAL_LOGS_DIR (or an explicit :memory: database)`,
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const result = checkTestStorePaths();
    const errors = formatTestStorePathErrors(result);
    if (errors.length) {
      console.error('test-store-paths: isolation guard failed');
      for (const error of errors) console.error(`- ${error}`);
      process.exitCode = 1;
    } else {
      console.log(`test-store-paths: ${result.storeOpening.length} store-opening test file(s), all self-isolated`);
    }
  } catch (error) {
    console.error(`test-store-paths: ${error.message}`);
    process.exitCode = 1;
  }
}
