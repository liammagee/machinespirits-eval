#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'acorn';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_ALLOWLIST = path.join(ROOT, 'config', 'evaluation-data-path-allowlist.json');

const PATH_KINDS = {
  databasePaths: {
    segments: ['data', 'evaluations.db'],
    replacement: 'resolveEvaluationDbPath',
  },
  dialogueLogPaths: {
    segments: ['logs', 'tutor-dialogues'],
    replacement: 'resolveTutorDialoguesDir',
  },
};

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

function isJoinCall(node) {
  if (node?.type !== 'CallExpression') return false;
  if (node.callee?.type === 'Identifier') return node.callee.name === 'join';
  return (
    node.callee?.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.property?.type === 'Identifier' &&
    node.callee.property.name === 'join'
  );
}

function containsSequence(values, sequence) {
  return values.some(
    (value, index) => value === sequence[0] && sequence.every((part, offset) => values[index + offset] === part),
  );
}

export function findHardcodedEvaluationPaths(source, file = '<source>') {
  const ast = parse(source, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    locations: true,
    allowHashBang: true,
  });
  const findings = [];
  walkAst(ast, (node) => {
    if (!isJoinCall(node)) return;
    const argumentsAsStrings = node.arguments.map(literalString);
    for (const [kind, rule] of Object.entries(PATH_KINDS)) {
      if (!containsSequence(argumentsAsStrings, rule.segments)) continue;
      findings.push({ file, line: node.loc.start.line, kind, replacement: rule.replacement });
    }
  });
  return findings;
}

export function scanEvaluationScripts(rootDir = ROOT) {
  const scriptsDir = path.join(rootDir, 'scripts');
  return fs
    .readdirSync(scriptsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .flatMap((entry) => {
      const relative = path.posix.join('scripts', entry.name);
      return findHardcodedEvaluationPaths(fs.readFileSync(path.join(scriptsDir, entry.name), 'utf8'), relative);
    });
}

function duplicateEntries(values) {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
}

export function checkEvaluationDataPaths({ rootDir = ROOT, allowlistPath = DEFAULT_ALLOWLIST } = {}) {
  const allowlist = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
  if (allowlist.version !== 1) throw new Error('evaluation data-path allowlist must have version 1');

  const findings = scanEvaluationScripts(rootDir);
  const unexpected = [];
  const stale = [];
  const duplicates = [];

  for (const kind of Object.keys(PATH_KINDS)) {
    if (!Array.isArray(allowlist[kind])) throw new Error(`evaluation data-path allowlist is missing ${kind}`);
    duplicates.push(...duplicateEntries(allowlist[kind]).map((file) => ({ kind, file })));
    const allowed = new Set(allowlist[kind]);
    const detected = new Set(findings.filter((finding) => finding.kind === kind).map((finding) => finding.file));
    unexpected.push(...findings.filter((finding) => finding.kind === kind && !allowed.has(finding.file)));
    stale.push(...allowlist[kind].filter((file) => !detected.has(file)).map((file) => ({ kind, file })));
  }

  return { findings, unexpected, stale, duplicates };
}

export function formatEvaluationDataPathErrors(result) {
  const lines = [];
  for (const finding of result.unexpected) {
    lines.push(
      `${finding.file}:${finding.line} builds an evaluation path directly; call ${finding.replacement} from services/evaluationDataPaths.js instead`,
    );
  }
  for (const entry of result.stale) {
    lines.push(`${entry.file} no longer needs the ${entry.kind} allowlist entry; remove it`);
  }
  for (const entry of result.duplicates) {
    lines.push(`${entry.file} appears more than once in the ${entry.kind} allowlist`);
  }
  return lines;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const result = checkEvaluationDataPaths();
    const errors = formatEvaluationDataPathErrors(result);
    if (errors.length) {
      console.error('evaluation-data-paths: hardcoded path guard failed');
      for (const error of errors) console.error(`- ${error}`);
      process.exitCode = 1;
    } else {
      const files = new Set(result.findings.map((finding) => finding.file));
      console.log(`evaluation-data-paths: ${files.size} legacy script(s) allowlisted; no new hardcoded paths`);
    }
  } catch (error) {
    console.error(`evaluation-data-paths: ${error.message}`);
    process.exitCode = 1;
  }
}
