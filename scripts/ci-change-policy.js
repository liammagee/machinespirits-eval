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

const VALIDATOR_ONLY_GROUPS = [
  {
    paths: new Set([
      'scripts/check-tutor-stub-resistant-profile-study-go-request.js',
      'tests/tutorStubResistantProfileStudyGoRequest.test.js',
    ]),
    tests: ['tests/tutorStubResistantProfileStudyGoRequest.test.js'],
  },
];

export function fullCiClassification(reason) {
  return {
    profile: 'full',
    fullRequired: true,
    validationRequired: true,
    authorizationRequired: false,
    validatorPaths: [],
    validatorTests: [],
    reason,
  };
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
  return (
    FOCUSED_EXACT_PATHS.has(file) ||
    FOCUSED_PATH_PREFIXES.some((prefix) => file.startsWith(prefix)) ||
    STUDY_GO_METADATA_PATH.test(file)
  );
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
      validationRequired: safeChangedFiles.some(pathRequiresValidationFramework),
      authorizationRequired: safeChangedFiles.some((file) => STUDY_GO_METADATA_PATH.test(file)),
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
      validationRequired: true,
      authorizationRequired: false,
      validatorPaths: [],
      validatorTests: [],
      reason: `full CI boundary changed: ${fullPaths.join(', ')}`,
    };
  }

  return {
    profile: 'focused',
    fullRequired: false,
    validationRequired: safeChangedFiles.some(pathRequiresValidationFramework),
    authorizationRequired: safeChangedFiles.some((file) => STUDY_GO_METADATA_PATH.test(file)),
    validatorPaths: [],
    validatorTests: [],
    reason: `focused authored metadata only: ${safeChangedFiles.join(', ')}`,
  };
}

function git(args, projectRoot = PROJECT_ROOT) {
  return execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8' }).trim();
}

export function changedFilesBetween(base, head, projectRoot = PROJECT_ROOT) {
  const output = git(['diff', '--name-only', '-z', `${base}...${head}`], projectRoot);
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
  const output = git(['ls-files', '--others', '--exclude-standard', '-z'], projectRoot);
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
      `profile=${result.profile}\nfull_required=${result.fullRequired}\nvalidation_required=${result.validationRequired}\nauthorization_required=${result.authorizationRequired}\nvalidator_required=${result.validatorTests.length > 0}\nvalidator_tests=${result.validatorTests.join(' ')}\nvalidator_paths=${result.validatorPaths.join(' ')}\n`,
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
