#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const SURFACE_ACCEPTANCE_PATHS = [
  '.github/workflows/tutor-stub-surface-acceptance.yml',
  'fixtures/tutor-stub-surface-acceptance/**',
  'package.json',
  'package-lock.json',
  'public/tutor/**',
  'routes/tutorStubSessionRoutes.js',
  'scripts/run-tutor-stub-surface-acceptance.mjs',
  'scripts/tutor-stub-surface-acceptance-scenario.mjs',
  'scripts/tutor-stub-acceptance-server.mjs',
  'scripts/tutor-stub-surface-ci-policy.js',
  'scripts/tutor-stub.js',
  'services/cliProviderBridge.js',
  'services/evalSurfaces.js',
  'services/tutorStubProcessSessionFactory.js',
  'services/tutorStubSessionHost.js',
  'services/tutorStubSurfaceAcceptanceContract.js',
];

const SURFACE_ACCEPTANCE_PACKAGE_SCRIPTS = [
  'preinstall',
  'install',
  'postinstall',
  'prepublish',
  'preprepare',
  'prepare',
  'postprepare',
  'prepack',
  'postpack',
  'scriptorium:ux-smoke',
  'tutor:stub:acceptance:web',
];

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableJson(entry)]),
  );
}

function sameJson(left, right) {
  return JSON.stringify(stableJson(left)) === JSON.stringify(stableJson(right));
}

export function pathTriggersSurfaceAcceptance(file) {
  return SURFACE_ACCEPTANCE_PATHS.some((candidate) =>
    candidate.endsWith('/**') ? file.startsWith(candidate.slice(0, -2)) : file === candidate,
  );
}

export function packageManifestChangeRequiresSurfaceAcceptance(baseManifest, headManifest) {
  if (!baseManifest || !headManifest) return true;
  const { scripts: baseScripts = {}, ...baseRuntime } = baseManifest;
  const { scripts: headScripts = {}, ...headRuntime } = headManifest;
  if (!sameJson(baseRuntime, headRuntime)) return true;
  return SURFACE_ACCEPTANCE_PACKAGE_SCRIPTS.some(
    (script) => (baseScripts[script] || null) !== (headScripts[script] || null),
  );
}

export function classifySurfaceAcceptance({ changedFiles, baseManifest = null, headManifest = null, force = false }) {
  if (force) return { required: true, reason: 'manual workflow dispatch' };
  const relevant = changedFiles.filter(pathTriggersSurfaceAcceptance);
  const nonManifest = relevant.filter((file) => file !== 'package.json');
  if (nonManifest.length > 0) {
    return { required: true, reason: `surface boundary changed: ${nonManifest.join(', ')}` };
  }
  if (!relevant.includes('package.json')) return { required: false, reason: 'no surface boundary changed' };
  if (packageManifestChangeRequiresSurfaceAcceptance(baseManifest, headManifest)) {
    return { required: true, reason: 'package runtime metadata or surface commands changed' };
  }
  return { required: false, reason: 'package.json change is unrelated scripts only' };
}

function git(args, projectRoot = PROJECT_ROOT) {
  return execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8' }).trim();
}

export function packageManifestAtRef(ref, projectRoot = PROJECT_ROOT) {
  return JSON.parse(git(['show', `${ref}:package.json`], projectRoot));
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

export function classifySurfaceAcceptanceRange({ base, head, projectRoot = PROJECT_ROOT, force = false }) {
  if (force) return classifySurfaceAcceptance({ changedFiles: [], force: true });
  let changedFiles;
  try {
    changedFiles = changedFilesBetween(base, head, projectRoot);
  } catch {
    return { required: true, reason: 'change range could not be classified' };
  }
  const packageChanged = changedFiles.includes('package.json');
  let baseManifest = null;
  let headManifest = null;
  if (packageChanged) {
    try {
      baseManifest = packageManifestAtRef(base, projectRoot);
      headManifest = packageManifestAtRef(head, projectRoot);
    } catch {
      return { required: true, reason: 'package manifests could not be compared' };
    }
  }
  return classifySurfaceAcceptance({
    changedFiles,
    baseManifest,
    headManifest,
  });
}

function parseArgs(argv) {
  const args = { base: null, head: null, githubOutput: null, force: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--base') args.base = argv[++index] || null;
    else if (token === '--head') args.head = argv[++index] || null;
    else if (token === '--github-output') args.githubOutput = argv[++index] || null;
    else if (token === '--force') args.force = true;
    else throw new Error(`unknown argument: ${token}`);
  }
  if (!args.force && (!args.base || !args.head))
    throw new Error('--base and --head are required unless --force is set');
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = classifySurfaceAcceptanceRange(args);
  if (args.githubOutput) fs.appendFileSync(args.githubOutput, `surface_required=${result.required}\n`);
  console.log(JSON.stringify(result));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(`surface-ci-policy: ${error.message}`);
    process.exitCode = 1;
  }
}
