#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
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
]);

// These paths live on otherwise-authored surfaces, but runtime services or
// skipped full-CI contracts consume their contents directly.
const FULL_CI_EXACT_PATHS = new Set([
  'README.md',
  'docs/pedagogical-move-contract.md',
  'docs/ref-status.md',
  'docs/research/human-coding-codebook.md',
  'docs/research/paper-full-2.0.md',
  'workplan/items/adaptive-warrant-outcome-study.md',
  'workplan/items/guarded-learner-outcome-study.md',
  'workplan/items/resistance-action-register-integration.md',
]);

const FULL_CI_PATH_PREFIXES = ['docs/adaptation-refinement/'];

// Ref governance is a separate integrity surface. Select it for changes that
// can alter the managed-ref contract, while letting unrelated full-CI changes
// avoid failing on external ref drift that they did not introduce.
const REF_GOVERNANCE_EXACT_PATHS = new Set([
  '.github/workflows/ref-governance.yml',
  '.github/workflows/test.yml',
  'docs/ref-status.md',
  'docs/tagging-and-version-protocol.md',
  'scripts/ci-change-policy.js',
  'scripts/ref-governance.js',
  'tests/ciChangePolicy.test.js',
  'tests/refGovernance.test.js',
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

// Historical request files are executable inputs to several distinct runtime
// and test contracts. A filename pattern cannot safely select one validator.
const STUDY_GO_RUNTIME_PATH = /^config\/[^/]*study-go-request[^/]*\.json$/u;

// Nothing is allowlisted. The one entry this held (the go-request contract
// test) was deleted with the checker and packager on 2026-09-03. A path that
// wants validator-only CI must be added here with its test, on purpose.
const VALIDATOR_ONLY_GROUPS = [];

export function fullCiClassification(reason) {
  return {
    profile: 'full',
    fullRequired: true,
    refGovernanceRequired: true,
    validationRequired: true,
    validatorPaths: [],
    validatorTests: [],
    reason,
  };
}

export function pathRequiresRefGovernance(file) {
  return REF_GOVERNANCE_EXACT_PATHS.has(file);
}

export function validateChangedPath(file) {
  if (typeof file !== 'string' || file.length === 0) throw new Error('changed path must not be empty');
  if (file.trim() !== file || /[\0\r\n]/u.test(file)) throw new Error(`changed path is not canonical: ${file}`);
  if (path.posix.isAbsolute(file) || path.win32.isAbsolute(file) || file.includes('\\')) {
    throw new Error(`changed path must be repository-relative: ${file}`);
  }
  if (file === '.' || path.posix.normalize(file) !== file || file.split('/').some((part) => part === '..')) {
    throw new Error(`changed path is not canonical: ${file}`);
  }
  return file;
}

export function validateChangedFiles(changedFiles) {
  if (!Array.isArray(changedFiles)) throw new Error('changed paths must be an array');
  return [...new Set(changedFiles.map(validateChangedPath))];
}

export function pathAllowsFocusedCi(file) {
  if (
    FULL_CI_EXACT_PATHS.has(file) ||
    FULL_CI_PATH_PREFIXES.some((prefix) => file.startsWith(prefix)) ||
    STUDY_GO_RUNTIME_PATH.test(file)
  ) {
    return false;
  }
  return FOCUSED_EXACT_PATHS.has(file) || FOCUSED_PATH_PREFIXES.some((prefix) => file.startsWith(prefix));
}

export function pathRequiresValidationFramework(file) {
  return file.startsWith('docs/research/');
}

export function pathAllowsValidatorOnlyCi(file) {
  return VALIDATOR_ONLY_GROUPS.some((group) => group.paths.has(file));
}

export function selectValidatorOnlyCi(changedFiles) {
  if (!Array.isArray(changedFiles) || changedFiles.length === 0) return null;
  const validatorPaths = changedFiles.filter((file) => !pathAllowsFocusedCi(file));
  if (validatorPaths.length === 0 || validatorPaths.some((file) => !pathAllowsValidatorOnlyCi(file))) return null;

  const selectedGroups = VALIDATOR_ONLY_GROUPS.filter((group) => validatorPaths.some((file) => group.paths.has(file)));
  return {
    paths: [...new Set(validatorPaths)].sort(),
    tests: [...new Set(selectedGroups.flatMap((group) => group.tests))].sort(),
  };
}

export function classifyCiChanges({ changedFiles, forceFull = false }) {
  if (forceFull) return fullCiClassification('manual workflow dispatch');
  let safeChangedFiles;
  try {
    safeChangedFiles = validateChangedFiles(changedFiles);
  } catch (error) {
    return fullCiClassification(`invalid changed path: ${error.message}`);
  }
  if (safeChangedFiles.length === 0) return fullCiClassification('no changed files could be classified');

  const validatorOnly = selectValidatorOnlyCi(safeChangedFiles);
  if (validatorOnly) {
    return {
      profile: 'validator-only',
      fullRequired: false,
      refGovernanceRequired: safeChangedFiles.some(pathRequiresRefGovernance),
      validationRequired: safeChangedFiles.some(pathRequiresValidationFramework),
      validatorPaths: validatorOnly.paths,
      validatorTests: validatorOnly.tests,
      reason: `allowlisted validator-only change: ${validatorOnly.paths.join(', ')}`,
    };
  }

  const fullPaths = safeChangedFiles.filter((file) => !pathAllowsFocusedCi(file));
  if (fullPaths.length > 0) {
    return {
      profile: 'full',
      fullRequired: true,
      refGovernanceRequired: safeChangedFiles.some(pathRequiresRefGovernance),
      validationRequired: true,
      validatorPaths: [],
      validatorTests: [],
      reason: `full CI boundary changed: ${fullPaths.join(', ')}`,
    };
  }

  return {
    profile: 'focused',
    fullRequired: false,
    refGovernanceRequired: safeChangedFiles.some(pathRequiresRefGovernance),
    validationRequired: safeChangedFiles.some(pathRequiresValidationFramework),
    validatorPaths: [],
    validatorTests: [],
    reason: `focused authored metadata only: ${safeChangedFiles.join(', ')}`,
  };
}

function git(args, projectRoot = PROJECT_ROOT, { trim = true } = {}) {
  const output = execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8' });
  return trim ? output.trim() : output;
}

export function changedFilesBetween(base, head, projectRoot = PROJECT_ROOT) {
  // Disable rename folding so both the deleted source and added destination
  // reach the path classifier. Otherwise runtime.js -> docs/runtime.md looks
  // like an authored-doc-only change.
  const output = git(['diff', '--no-renames', '--name-only', '-z', `${base}...${head}`], projectRoot, {
    trim: false,
  });
  return output ? output.split('\0').filter(Boolean) : [];
}

export function collectCiRange({ base, head, projectRoot = PROJECT_ROOT }) {
  if (!base || !head) {
    return { ok: false, changedFiles: [], error: 'base and head are required' };
  }
  try {
    return { ok: true, changedFiles: changedFilesBetween(base, head, projectRoot), error: null };
  } catch {
    return { ok: false, changedFiles: [], error: 'change range could not be classified' };
  }
}

export function classifyCiRange({ base, head, projectRoot = PROJECT_ROOT, forceFull = false }) {
  if (forceFull) return classifyCiChanges({ changedFiles: [], forceFull: true });
  const range = collectCiRange({ base, head, projectRoot });
  return range.ok ? classifyCiChanges({ changedFiles: range.changedFiles }) : fullCiClassification(range.error);
}

function checkUntrackedWhitespace(changedFiles, projectRoot) {
  const output = git(['ls-files', '--others', '--exclude-standard', '-z'], projectRoot, { trim: false });
  const untracked = new Set(output.split('\0').filter(Boolean));
  for (const file of changedFiles.filter((entry) => untracked.has(entry))) {
    try {
      execFileSync('git', ['diff', '--no-index', '--check', '--', os.devNull, path.join(projectRoot, file)], {
        cwd: projectRoot,
        encoding: 'utf8',
      });
    } catch (error) {
      if (error.status !== 1) throw error;
    }
  }
}

export function validateFocusedChanges({ changedFiles, projectRoot = PROJECT_ROOT, base = null, head = null }) {
  const safeChangedFiles = validateChangedFiles(changedFiles);
  const classification = classifyCiChanges({ changedFiles: safeChangedFiles });
  if (classification.fullRequired) {
    throw new Error(`focused validation refused: ${classification.reason}`);
  }

  if (base || head) {
    if (!base || !head) throw new Error('focused validation refused: change range could not be classified');
    execFileSync('git', ['diff', '--check', `${base}...${head}`], { cwd: projectRoot, encoding: 'utf8' });
    execFileSync('git', ['diff', '--check'], { cwd: projectRoot, encoding: 'utf8' });
    execFileSync('git', ['diff', '--cached', '--check'], { cwd: projectRoot, encoding: 'utf8' });
    checkUntrackedWhitespace(safeChangedFiles, projectRoot);
  }
  for (const file of safeChangedFiles.filter((entry) => entry.endsWith('.json'))) {
    JSON.parse(fs.readFileSync(path.join(projectRoot, file), 'utf8'));
  }
  return classification;
}

function parseArgs(argv) {
  const args = {
    base: null,
    head: null,
    githubOutput: null,
    forceFull: false,
    validateFocused: false,
    changedFiles: [],
    projectRoot: PROJECT_ROOT,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--base') args.base = argv[++index] || null;
    else if (token === '--head') args.head = argv[++index] || null;
    else if (token === '--changed-file') {
      const file = argv[++index];
      if (!file || file.startsWith('--')) throw new Error('--changed-file requires a path');
      args.changedFiles.push(file);
    } else if (token === '--project-root') {
      args.projectRoot = argv[++index] || null;
      if (!args.projectRoot) throw new Error('--project-root requires a path');
    } else if (token === '--github-output') args.githubOutput = argv[++index] || null;
    else if (token === '--force-full') args.forceFull = true;
    else if (token === '--validate-focused') args.validateFocused = true;
    else throw new Error(`unknown argument: ${token}`);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const supplemental = validateChangedFiles(args.changedFiles);
  const range = args.forceFull
    ? { ok: true, changedFiles: [], error: null }
    : collectCiRange({ base: args.base, head: args.head, projectRoot: args.projectRoot });
  const changedFiles = [...new Set([...range.changedFiles, ...supplemental])];
  const result = args.forceFull
    ? classifyCiChanges({ changedFiles: [], forceFull: true })
    : range.ok
      ? classifyCiChanges({ changedFiles })
      : fullCiClassification(range.error);
  if (args.validateFocused) {
    if (!range.ok) throw new Error(`focused validation refused: ${range.error}`);
    validateFocusedChanges({ changedFiles, projectRoot: args.projectRoot, base: args.base, head: args.head });
  }
  if (args.githubOutput) {
    fs.appendFileSync(
      args.githubOutput,
      `profile=${result.profile}\nfull_required=${result.fullRequired}\nref_governance_required=${result.refGovernanceRequired}\nvalidation_required=${result.validationRequired}\nvalidator_required=${result.validatorTests.length > 0}\nvalidator_tests=${result.validatorTests.join(' ')}\nvalidator_paths=${result.validatorPaths.join(' ')}\n`,
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
