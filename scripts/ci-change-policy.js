#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const FOCUSED_EXACT_PATHS = new Set([
  '.github/pull_request_template.md',
  'AGENTS.md',
  'CLAUDE.md',
  'DOCS.md',
  'GEMINI.md',
  'README.md',
]);

const FOCUSED_PATH_PREFIXES = [
  '.agents/skills/',
  '.claude/skills/',
  '.codex/skills/',
  'docs/',
  'workplan/inbox/',
  'workplan/items/',
  'workplan/playbook/',
];

const STUDY_GO_METADATA_PATH = /^config\/[^/]*study-go-request[^/]*\.json$/u;

export function pathAllowsFocusedCi(file) {
  return (
    FOCUSED_EXACT_PATHS.has(file) ||
    FOCUSED_PATH_PREFIXES.some((prefix) => file.startsWith(prefix)) ||
    STUDY_GO_METADATA_PATH.test(file)
  );
}

export function pathRequiresValidationFramework(file) {
  return file.startsWith('docs/research/');
}

export function classifyCiChanges({ changedFiles, forceFull = false }) {
  if (forceFull) {
    return {
      profile: 'full',
      fullRequired: true,
      validationRequired: true,
      authorizationRequired: false,
      reason: 'manual workflow dispatch',
    };
  }
  if (!Array.isArray(changedFiles) || changedFiles.length === 0) {
    return {
      profile: 'full',
      fullRequired: true,
      validationRequired: true,
      authorizationRequired: false,
      reason: 'no changed files could be classified',
    };
  }

  const fullPaths = changedFiles.filter((file) => !pathAllowsFocusedCi(file));
  if (fullPaths.length > 0) {
    return {
      profile: 'full',
      fullRequired: true,
      validationRequired: true,
      authorizationRequired: false,
      reason: `full CI boundary changed: ${fullPaths.join(', ')}`,
    };
  }

  return {
    profile: 'focused',
    fullRequired: false,
    validationRequired: changedFiles.some(pathRequiresValidationFramework),
    authorizationRequired: changedFiles.some((file) => STUDY_GO_METADATA_PATH.test(file)),
    reason: `focused authored metadata only: ${changedFiles.join(', ')}`,
  };
}

function git(args, projectRoot = PROJECT_ROOT) {
  return execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8' }).trim();
}

export function changedFilesBetween(base, head, projectRoot = PROJECT_ROOT) {
  const output = git(['diff', '--name-only', `${base}...${head}`], projectRoot);
  return output
    ? output
        .split('\n')
        .map((file) => file.trim())
        .filter(Boolean)
    : [];
}

export function classifyCiRange({ base, head, projectRoot = PROJECT_ROOT, forceFull = false }) {
  if (forceFull) return classifyCiChanges({ changedFiles: [], forceFull: true });
  try {
    return classifyCiChanges({ changedFiles: changedFilesBetween(base, head, projectRoot) });
  } catch {
    return {
      profile: 'full',
      fullRequired: true,
      validationRequired: true,
      authorizationRequired: false,
      reason: 'change range could not be classified',
    };
  }
}

export function validateFocusedChanges({ changedFiles, projectRoot = PROJECT_ROOT, base = null, head = null }) {
  const classification = classifyCiChanges({ changedFiles });
  if (classification.fullRequired) {
    throw new Error(`focused validation refused: ${classification.reason}`);
  }

  if (base && head) {
    execFileSync('git', ['diff', '--check', `${base}...${head}`], { cwd: projectRoot, encoding: 'utf8' });
  }
  for (const file of changedFiles.filter((entry) => entry.endsWith('.json'))) {
    JSON.parse(fs.readFileSync(path.join(projectRoot, file), 'utf8'));
  }
  return classification;
}

function parseArgs(argv) {
  const args = { base: null, head: null, githubOutput: null, forceFull: false, validateFocused: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--base') args.base = argv[++index] || null;
    else if (token === '--head') args.head = argv[++index] || null;
    else if (token === '--github-output') args.githubOutput = argv[++index] || null;
    else if (token === '--force-full') args.forceFull = true;
    else if (token === '--validate-focused') args.validateFocused = true;
    else throw new Error(`unknown argument: ${token}`);
  }
  if (!args.forceFull && (!args.base || !args.head)) {
    throw new Error('--base and --head are required unless --force-full is set');
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = classifyCiRange(args);
  if (args.validateFocused) {
    const changedFiles = changedFilesBetween(args.base, args.head);
    validateFocusedChanges({ changedFiles, base: args.base, head: args.head });
  }
  if (args.githubOutput) {
    fs.appendFileSync(
      args.githubOutput,
      `profile=${result.profile}\nfull_required=${result.fullRequired}\nvalidation_required=${result.validationRequired}\nauthorization_required=${result.authorizationRequired}\n`,
    );
  }
  console.log(JSON.stringify(result));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(`ci-change-policy: ${error.message}`);
    process.exitCode = 1;
  }
}
