import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createHash } from 'node:crypto';

export const TUTOR_STUB_FIRST_DRAFT_PREFLIGHT_CERTIFICATE_SCHEMA =
  'machinespirits.tutor-stub.first-draft-preflight-certificate.v1';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
}

export function tutorStubFirstDraftPreflightSha256(value) {
  const payload = Buffer.isBuffer(value)
    ? value
    : Buffer.from(typeof value === 'string' ? value : JSON.stringify(canonical(value)));
  return createHash('sha256').update(payload).digest('hex');
}

function walkFiles(root, relativeDir, predicate) {
  const directory = path.join(root, relativeDir);
  if (!fs.existsSync(directory)) return [];
  const output = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relative = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) output.push(...walkFiles(root, relative, predicate));
    else if (entry.isFile() && predicate(relative)) output.push(relative);
  }
  return output;
}

function normalizeFile(root, filePath) {
  const absolute = path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
  const relative = path.relative(root, absolute).split(path.sep).join('/');
  return { absolute, relative };
}

function fileInventory(root, filePaths) {
  return [...new Set(filePaths)]
    .map((filePath) => normalizeFile(root, filePath))
    .sort((left, right) => left.relative.localeCompare(right.relative))
    .map(({ absolute, relative }) => {
      if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
        throw new Error(`preflight certificate input is missing: ${relative}`);
      }
      const bytes = fs.readFileSync(absolute);
      return { path: relative, bytes: bytes.byteLength, sha256: tutorStubFirstDraftPreflightSha256(bytes) };
    });
}

function defaultImplementationFiles(root) {
  const exclusions = new Set([
    'scripts/tutor-stub-first-draft-outer-loop.js',
    'services/tutorStubFirstDraftOuterLoop.js',
  ]);
  return [
    'package.json',
    ...(fs.existsSync(path.join(root, 'package-lock.json')) ? ['package-lock.json'] : []),
    ...walkFiles(root, 'scripts', (filePath) => /\.js$/u.test(filePath) && !exclusions.has(filePath)),
    ...walkFiles(root, 'services', (filePath) => /\.js$/u.test(filePath) && !exclusions.has(filePath)),
    ...walkFiles(root, 'tutor-core', (filePath) => /\.(?:js|json)$/u.test(filePath)),
    ...walkFiles(
      root,
      'config',
      (filePath) => !filePath.startsWith('config/tutor-stub-campaigns/') && /\.(?:json|ya?ml)$/u.test(filePath),
    ),
    ...(fs.existsSync(path.join(root, 'config', 'tutor-stub-codex-speaker-instructions.md'))
      ? ['config/tutor-stub-codex-speaker-instructions.md']
      : []),
  ];
}

function defaultWorldCompilerFiles(root) {
  return [
    'scripts/audit-derivation-world-quality.js',
    ...walkFiles(root, 'config/drama-derivation', (filePath) => /\.ya?ml$/u.test(filePath)),
    ...walkFiles(root, 'services/dramaticDerivation', (filePath) => /\.js$/u.test(filePath)),
  ];
}

function localImportSpecifiers(source) {
  const patterns = [
    /\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/gu,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/gu,
    /\brequire\(\s*['"]([^'"]+)['"]\s*\)/gu,
  ];
  return [...new Set(patterns.flatMap((pattern) => [...source.matchAll(pattern)].map((match) => match[1])))].filter(
    (specifier) => specifier.startsWith('.'),
  );
}

function resolveLocalImport(importer, specifier) {
  const base = path.resolve(path.dirname(importer), specifier);
  const candidates = [base, `${base}.js`, `${base}.json`, path.join(base, 'index.js')];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
}

function literalResourceCandidates(root, importer, source) {
  const campaignDirectory = path.join(root, 'config', 'tutor-stub-campaigns');
  const resources = [];
  const quoted = [...source.matchAll(/['"]([^'"\n]+\.(?:json|md|txt|ya?ml))['"]/giu)].map((match) => match[1]);
  for (const value of quoted) {
    const candidates = [];
    if (path.isAbsolute(value)) candidates.push(value);
    else if (value.startsWith('.')) candidates.push(path.resolve(path.dirname(importer), value));
    else {
      candidates.push(path.join(root, value));
      candidates.push(path.join(path.dirname(importer), value));
      if (/^first-draft-[a-z0-9-]+\.ya?ml$/iu.test(value)) {
        candidates.push(path.join(campaignDirectory, value));
      }
    }
    const resolved = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    if (resolved) resources.push(resolved);
  }
  return resources;
}

function focusedTestDependencyFiles(root, focusedTestSuites) {
  const selected = new Set(
    focusedTestSuites.flatMap((suite) => suite.testFiles).map((filePath) => path.resolve(root, filePath)),
  );
  const files = [];
  const visited = new Set();
  const queue = [...selected];
  const campaignDirectory = path.join(root, 'config', 'tutor-stub-campaigns');
  while (queue.length) {
    const absolute = queue.shift();
    if (visited.has(absolute) || !fs.existsSync(absolute)) continue;
    visited.add(absolute);
    const source = fs.readFileSync(absolute, 'utf8');
    files.push(...literalResourceCandidates(root, absolute, source));
    for (const match of source.matchAll(/first-draft-[a-z0-9-]+\.yaml/giu)) {
      const candidate = path.join(campaignDirectory, match[0]);
      if (fs.existsSync(candidate)) files.push(candidate);
    }
    for (const specifier of localImportSpecifiers(source)) {
      const dependency = resolveLocalImport(absolute, specifier);
      if (!dependency || !dependency.startsWith(`${path.resolve(root)}${path.sep}`)) continue;
      if (!selected.has(dependency)) files.push(dependency);
      if (/\.(?:c|m)?js$/u.test(dependency)) queue.push(dependency);
    }
  }
  return files;
}

function normalizedArg(root, value) {
  const text = String(value);
  if (text === process.execPath) return '$NODE';
  const absoluteRoot = `${path.resolve(root)}${path.sep}`;
  return text.startsWith(absoluteRoot) ? `$ROOT/${path.relative(root, text).split(path.sep).join('/')}` : text;
}

export function buildTutorStubFirstDraftPreflightBoundary({
  root,
  config,
  commands,
  focusedTestSuites,
  implementationHead,
  runtime = {
    node: process.version,
    v8: process.versions.v8,
    platform: process.platform,
    arch: process.arch,
  },
  implementationFiles = null,
  worldCompilerFiles = null,
}) {
  const testFiles = focusedTestSuites.flatMap((suite) => suite.testFiles);
  const fixtureFiles = [
    ...(config.preflight?.model_free_fixtures || []),
    ...(config.preflight?.structural_regression_fixtures || []),
  ].map((filePath) => (path.isAbsolute(filePath) ? filePath : path.join(root, filePath)));
  const boundary = {
    schema: 'machinespirits.tutor-stub.first-draft-preflight-boundary.v1',
    implementation: {
      sources: fileInventory(root, implementationFiles || defaultImplementationFiles(root)),
      excludedOuterLoopBookkeeping: [
        'config/tutor-stub-campaigns/**',
        'scripts/tutor-stub-first-draft-outer-loop.js',
        'services/tutorStubFirstDraftOuterLoop.js',
      ],
    },
    runtime: canonical(runtime),
    preflightConfiguration: canonical(config.preflight || {}),
    commandPlan: commands.map((command) => ({
      id: command.id,
      kind: command.kind,
      suiteId: command.suiteId || null,
      tap: command.tap === true,
      argv: command.argv.map((part) => normalizedArg(root, part)),
    })),
    testInventory: focusedTestSuites.map((suite) => ({
      id: suite.id,
      testFiles: [...suite.testFiles],
    })),
    testDependencyPolicy: {
      selectedTestsOnly: true,
      recursiveLocalImports: true,
      literalReferencedResources: true,
      unselectedTestsExcluded: true,
    },
    testFiles: fileInventory(root, testFiles),
    testDependencies: fileInventory(root, focusedTestDependencyFiles(root, focusedTestSuites)),
    fixtureFiles: fileInventory(root, fixtureFiles),
    worldCompilerInputs: fileInventory(root, worldCompilerFiles || defaultWorldCompilerFiles(root)),
  };
  return {
    boundary,
    key: tutorStubFirstDraftPreflightSha256(boundary),
    observedHead: implementationHead,
  };
}

function capturedStream(artifact) {
  const bytes = fs.readFileSync(artifact.path);
  const sha256 = tutorStubFirstDraftPreflightSha256(bytes);
  if (bytes.byteLength !== artifact.bytes || sha256 !== artifact.sha256) {
    throw new Error(`preflight stream artifact changed before certification: ${artifact.path}`);
  }
  return { bytes: bytes.byteLength, sha256, base64: bytes.toString('base64') };
}

function certificatePayload(certificate) {
  const { certificateSha256: _ignored, ...payload } = certificate;
  return payload;
}

function commandArgMatches(actual, expected) {
  if (expected === '$NODE') return actual === process.execPath;
  if (String(expected).startsWith('$ROOT/')) {
    const suffix = String(expected).slice('$ROOT/'.length).split('/').join(path.sep);
    return actual === suffix || String(actual).endsWith(`${path.sep}${suffix}`);
  }
  return actual === expected;
}

function commandEvidenceValid(command, plan, index) {
  if (!command || !plan) return false;
  if (
    command.id !== plan.id ||
    command.kind !== plan.kind ||
    (command.suiteId || null) !== plan.suiteId ||
    command.order !== index + 1 ||
    command.status !== 'pass' ||
    !Array.isArray(command.argv) ||
    command.argv.length !== plan.argv.length ||
    !command.argv.every((arg, argIndex) => commandArgMatches(arg, plan.argv[argIndex]))
  )
    return false;
  if (plan.tap !== true) return command.tap === null;
  return (
    Number.isInteger(command.tap?.tests) &&
    command.tap.tests > 0 &&
    command.tap.pass === command.tap.tests &&
    command.tap.fail === 0 &&
    command.tap.cancelled === 0 &&
    command.tap.skipped === 0 &&
    command.tap.todo === 0 &&
    (command.tap.failureNames || []).length === 0
  );
}

export function buildTutorStubFirstDraftPreflightCertificate({ boundary, key, report, observedHead = null }) {
  const commands = report.commands.map((command) => ({
    ...structuredClone(command),
    stdout: capturedStream(command.stdout),
    stderr: capturedStream(command.stderr),
  }));
  const tapCommands = commands.filter((command) => command.tap !== null);
  const tapTotals = {
    tests: tapCommands.reduce((sum, command) => sum + Number(command.tap?.tests || 0), 0),
    pass: tapCommands.reduce((sum, command) => sum + Number(command.tap?.pass || 0), 0),
    fail: tapCommands.reduce((sum, command) => sum + Number(command.tap?.fail || 0), 0),
    cancelled: tapCommands.reduce((sum, command) => sum + Number(command.tap?.cancelled || 0), 0),
    skipped: tapCommands.reduce((sum, command) => sum + Number(command.tap?.skipped || 0), 0),
    todo: tapCommands.reduce((sum, command) => sum + Number(command.tap?.todo || 0), 0),
    failureNames: [...new Set(tapCommands.flatMap((command) => command.tap?.failureNames || []))],
  };
  const complete = commands.length > 0 && commands.length === boundary.commandPlan.length;
  const commandEvidenceComplete =
    complete && commands.every((command, index) => commandEvidenceValid(command, boundary.commandPlan[index], index));
  const reusable =
    report.status === 'pass' &&
    commandEvidenceComplete &&
    tapTotals.tests > 0 &&
    tapTotals.fail === 0 &&
    tapTotals.failureNames.length === 0;
  const certificate = {
    schema: TUTOR_STUB_FIRST_DRAFT_PREFLIGHT_CERTIFICATE_SCHEMA,
    key,
    boundary,
    status: reusable ? 'pass' : report.status === 'fail' ? 'fail' : 'incomplete',
    complete,
    commandEvidenceComplete,
    reusable,
    generatedAt: report.generatedAt,
    provenance: { observedHead },
    execution: {
      startedAt: report.startedAt,
      finishedAt: report.finishedAt,
      elapsedMs: report.elapsedMs,
      policy: structuredClone(report.executionPolicy),
    },
    tapTotals,
    failingNames: tapTotals.failureNames,
    commands,
    failedCommand: structuredClone(report.failedCommand),
    makesModelCalls: false,
    modelCalls: 0,
  };
  certificate.certificateSha256 = tutorStubFirstDraftPreflightSha256(certificatePayload(certificate));
  return certificate;
}

export function validateTutorStubFirstDraftPreflightCertificate(certificate, { boundary, key }) {
  const reasons = [];
  if (certificate?.schema !== TUTOR_STUB_FIRST_DRAFT_PREFLIGHT_CERTIFICATE_SCHEMA) reasons.push('schema_mismatch');
  if (certificate?.key !== key) reasons.push('key_mismatch');
  if (tutorStubFirstDraftPreflightSha256(certificate?.boundary) !== key) reasons.push('boundary_mismatch');
  if (certificate?.certificateSha256 !== tutorStubFirstDraftPreflightSha256(certificatePayload(certificate || {})))
    reasons.push('certificate_hash_mismatch');
  if (certificate?.status !== 'pass' || certificate?.reusable !== true) reasons.push('not_passing');
  if (certificate?.complete !== true) reasons.push('incomplete');
  if (!Array.isArray(certificate?.commands) || certificate.commands.length !== boundary.commandPlan.length) {
    reasons.push('command_inventory_mismatch');
  }
  if (!Number.isInteger(certificate?.tapTotals?.tests) || certificate.tapTotals.tests < 1) reasons.push('zero_tap');
  if (certificate?.tapTotals?.fail !== 0 || (certificate?.failingNames || []).length) reasons.push('tap_failures');
  for (const [index, command] of (certificate?.commands || []).entries()) {
    const plan = boundary.commandPlan[index];
    if (!commandEvidenceValid(command, plan, index)) reasons.push('command_evidence_mismatch');
    for (const streamName of ['stdout', 'stderr']) {
      const stream = command[streamName];
      let bytes = null;
      try {
        bytes = Buffer.from(stream?.base64 || '', 'base64');
      } catch {
        /* validated below */
      }
      if (
        !stream ||
        !bytes ||
        bytes.byteLength !== stream.bytes ||
        tutorStubFirstDraftPreflightSha256(bytes) !== stream.sha256
      )
        reasons.push(`${streamName}_capture_mismatch`);
    }
  }
  return { ok: reasons.length === 0, reasons: [...new Set(reasons)] };
}

export function tutorStubFirstDraftPreflightCertificatePath({ cacheDir, key }) {
  return path.join(cacheDir, `${key}.json`);
}

export function tutorStubFirstDraftHardCellBlocksRemaining({ execution, hardCellStatus, completeAllCells }) {
  if (hardCellStatus === 'pass' || execution?.hard_cell_must_pass_before_remaining !== true) {
    return false;
  }
  return execution?.mandatory_stage_dependency === true || completeAllCells !== true;
}

export function materializeTutorStubFirstDraftPreflightCertificate({
  certificate,
  iterationRoot,
  campaignId,
  cellId,
  certificatePath,
}) {
  const artifactDir = path.join(iterationRoot, 'preflight');
  const commands = certificate.commands.map((command) => {
    const stem = `${String(command.order).padStart(2, '0')}-${String(command.id).replace(/[^a-z0-9_-]+/giu, '-')}`;
    const materialized = structuredClone(command);
    for (const streamName of ['stdout', 'stderr']) {
      const bytes = Buffer.from(command[streamName].base64, 'base64');
      const filePath = path.join(artifactDir, `${stem}.${streamName}.log`);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, bytes, { flag: 'wx' });
      materialized[streamName] = {
        path: filePath,
        bytes: bytes.byteLength,
        sha256: tutorStubFirstDraftPreflightSha256(bytes),
      };
    }
    return materialized;
  });
  const generatedAt = new Date().toISOString();
  const report = {
    schema: 'machinespirits.tutor-stub.first-draft-preflight-execution.v1',
    generatedAt,
    campaignId: campaignId || null,
    cellId,
    status: 'pass',
    startedAt: certificate.execution.startedAt,
    finishedAt: certificate.execution.finishedAt,
    elapsedMs: 0,
    executionPolicy: structuredClone(certificate.execution.policy),
    makesModelCalls: false,
    modelCalls: 0,
    testInventory: {
      suiteCount: certificate.boundary.testInventory.length,
      fileCount: certificate.boundary.testInventory.reduce((sum, suite) => sum + suite.testFiles.length, 0),
      suites: structuredClone(certificate.boundary.testInventory),
    },
    commands,
    failedCommand: null,
    preflightRevision: {
      kind: 'deterministic_preflight_certificate',
      tutorGenerationResult: false,
      disposition: 'reused',
      certificateKey: certificate.key,
      certificateSha256: certificate.certificateSha256,
      certificatePath,
      sourceGeneratedAt: certificate.generatedAt,
      reusedAt: generatedAt,
    },
  };
  return report;
}
