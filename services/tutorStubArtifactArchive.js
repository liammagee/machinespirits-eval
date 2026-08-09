import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import zlib from 'node:zlib';

export const TUTOR_STUB_ARTIFACT_ARCHIVE_SCHEMA = 'machinespirits.tutor-stub.artifact-archive-manifest.v1';
export const TUTOR_STUB_ARTIFACT_ARCHIVE_POLICIES = Object.freeze(['off', 'best_effort', 'required']);

export function normalizeTutorStubArtifactArchivePolicy(value = 'off') {
  const normalized = String(value || 'off')
    .trim()
    .toLowerCase()
    .replaceAll('-', '_');
  if (!TUTOR_STUB_ARTIFACT_ARCHIVE_POLICIES.includes(normalized)) {
    throw new Error(
      `artifact archive policy must be one of ${TUTOR_STUB_ARTIFACT_ARCHIVE_POLICIES.join(', ')}; got ${value}`,
    );
  }
  return normalized;
}

export function requiredTutorStubArtifactArchiveArgs() {
  return ['--artifact-archive', 'required'];
}

function gitCommonDirectory(cwd) {
  const result = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
    cwd,
    encoding: 'utf8',
  });
  if (result.status !== 0) return null;
  const value = String(result.stdout || '').trim();
  return value ? path.resolve(cwd, value) : null;
}

function existingDirectory(candidate) {
  if (!candidate) return null;
  const resolved = path.resolve(candidate);
  try {
    return fs.statSync(resolved).isDirectory() ? resolved : null;
  } catch {
    return null;
  }
}

/** Resolve the stable private archive even when cwd is a linked tmp worktree. */
export function resolveTutorStubArtifactArchiveDirectory(
  explicit,
  { cwd = process.cwd(), repoRoot = cwd, env = process.env, commonGitDirectory = null } = {},
) {
  const configured = explicit || env.EVAL_ARCHIVE_DIR || env.TUTOR_STUB_ARTIFACT_ARCHIVE_DIR;
  if (configured) return existingDirectory(configured);

  const commonGitDir = commonGitDirectory || gitCommonDirectory(cwd);
  const mainRepoRoot = commonGitDir ? path.dirname(commonGitDir) : null;
  const candidates = [
    mainRepoRoot ? path.join(path.dirname(mainRepoRoot), 'machinespirits-eval-private') : null,
    path.join(path.dirname(path.resolve(repoRoot)), 'machinespirits-eval-private'),
    path.resolve(cwd, '..', 'machinespirits-eval-private'),
  ];
  for (const candidate of candidates) {
    const existing = existingDirectory(candidate);
    if (existing) return existing;
  }
  return null;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function logicalTracePath(sourceTracePath, repoRoot) {
  const absolute = path.resolve(sourceTracePath);
  const relative = path.relative(path.resolve(repoRoot), absolute);
  if (relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) {
    return relative;
  }
  return path.join('external', sha256(path.dirname(absolute)).slice(0, 16), path.basename(absolute));
}

function writeJsonAtomic(filePath, value) {
  const temporary = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, filePath);
}

function disabledMirror(policy, reason) {
  return {
    enabled: false,
    policy,
    reason,
    append() {
      return { ok: false, skipped: true, reason };
    },
    snapshot() {
      return { enabled: false, policy, status: 'unavailable', reason };
    },
  };
}

/**
 * Create the live, worktree-independent mirror for one redacted JSONL trace.
 * Each line is one concatenated gzip member, so a crash leaves a valid stream.
 */
export function createTutorStubArtifactArchiveMirror({
  policy: requestedPolicy = 'off',
  sourceTracePath,
  repoRoot = process.cwd(),
  archiveDir: explicitArchiveDir = null,
  env = process.env,
  commonGitDirectory = null,
  metadata = {},
} = {}) {
  const policy = normalizeTutorStubArtifactArchivePolicy(requestedPolicy);
  if (policy === 'off') return disabledMirror(policy, 'disabled');
  if (!sourceTracePath) throw new Error('artifact archive mirror requires sourceTracePath');

  const archiveDir = resolveTutorStubArtifactArchiveDirectory(explicitArchiveDir, {
    cwd: repoRoot,
    repoRoot,
    env,
    commonGitDirectory,
  });
  if (!archiveDir) {
    const message = 'durable tutor-stub artifact archive is unavailable; set EVAL_ARCHIVE_DIR before an empirical run';
    if (policy === 'required') throw new Error(message);
    return disabledMirror(policy, message);
  }

  const relativeSource = logicalTracePath(sourceTracePath, repoRoot);
  const base = path.join(archiveDir, 'artifacts', 'tutor-stub-live', relativeSource);
  const tracePath = `${base}.gz`;
  const manifestPath = `${base}.archive.json`;
  const createdAt = new Date().toISOString();
  const state = {
    schema: TUTOR_STUB_ARTIFACT_ARCHIVE_SCHEMA,
    status: 'running',
    policy,
    createdAt,
    updatedAt: createdAt,
    sourceTrace: relativeSource.split(path.sep).join('/'),
    sourceSha:
      metadata?.provenance?.git?.sha || metadata?.provenance?.git?.commit || metadata?.provenance?.commit || null,
    archiveTrace: path.relative(archiveDir, tracePath).split(path.sep).join('/'),
    compression: 'concatenated_gzip_members',
    eventCount: 0,
    lastSequence: 0,
    lastEventType: null,
    chainSha256: sha256(''),
    durableBeforeContinuation: true,
  };

  try {
    fs.mkdirSync(path.dirname(tracePath), { recursive: true });
    writeJsonAtomic(manifestPath, state);
  } catch (error) {
    const message = `cannot initialize tutor-stub artifact archive: ${error.message}`;
    if (policy === 'required') throw new Error(message, { cause: error });
    return disabledMirror(policy, message);
  }

  let enabled = true;
  let failureReason = null;
  return {
    get enabled() {
      return enabled;
    },
    policy,
    tracePath,
    manifestPath,
    append(line, event = {}) {
      if (!enabled) return { ok: false, skipped: true, reason: failureReason };
      try {
        const bytes = Buffer.from(String(line));
        fs.appendFileSync(tracePath, zlib.gzipSync(bytes));
        state.eventCount += 1;
        state.lastSequence = Number(event.seq || state.eventCount);
        state.lastEventType = event.type || null;
        state.status = state.status === 'sealed' || event.type === 'run_end' ? 'sealed' : 'running';
        state.updatedAt = new Date().toISOString();
        state.chainSha256 = sha256(`${state.chainSha256}\0${String(line)}`);
        writeJsonAtomic(manifestPath, state);
        return { ok: true, status: state.status, eventCount: state.eventCount };
      } catch (error) {
        failureReason = `tutor-stub artifact archive write failed: ${error.message}`;
        if (policy === 'required') throw new Error(failureReason, { cause: error });
        enabled = false;
        return { ok: false, skipped: false, reason: failureReason };
      }
    },
    snapshot() {
      return {
        enabled,
        policy,
        status: enabled ? state.status : 'failed',
        archiveTrace: state.archiveTrace,
        manifest: path.relative(archiveDir, manifestPath).split(path.sep).join('/'),
        eventCount: state.eventCount,
        chainSha256: state.chainSha256,
        reason: failureReason,
      };
    },
  };
}
