import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function repositoryRelativePath(root, value, label) {
  if (!value || path.isAbsolute(value)) throw new Error(`${label} must be repository-relative`);
  const normalized = path.normalize(value);
  const absolute = path.resolve(root, normalized);
  const relative = path.relative(root, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${label} must stay inside the repository`);
  }
  return { absolute, relative: relative.split(path.sep).join('/') };
}

function git(root, args, options = {}) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', ...options });
}

function resolveCommit(root, value, label) {
  try {
    return git(root, ['rev-parse', '--verify', `${value}^{commit}`]).trim();
  } catch {
    throw new Error(`${label} is not a commit`);
  }
}

function numericTokens(text) {
  return [...text.matchAll(/(?<![\w.])(?:\d{1,3}(?:[,_]\d{3})+|\d+)(?:\.\d+)?(?![\w.])/gu)].map((match) =>
    Number(match[0].replace(/[,_]/gu, '')),
  );
}

export function paidStudyGoNoteIssues({ text, designPath, launchCommit, spendCap }) {
  const issues = [];
  const firstNonblank = String(text)
    .split(/\r?\n/u)
    .find((line) => line.trim());
  if (firstNonblank?.trim() !== 'GO') issues.push('go_token');
  if (!String(text).includes(designPath)) issues.push('design_path');
  if (!String(text).includes(launchCommit)) issues.push('launch_commit');
  if (!numericTokens(String(text)).some((value) => value === spendCap)) issues.push('spend_cap');
  return issues;
}

export function verifyPaidStudyLaunchContract({
  root,
  designPath,
  launchCommit,
  goNoteCommit,
  goNotePath,
  spendCap,
  mainRef = 'origin/main',
}) {
  const repositoryRoot = path.resolve(root || '');
  if (!root || !fs.statSync(repositoryRoot).isDirectory()) throw new Error('repository root must be a directory');
  const design = repositoryRelativePath(repositoryRoot, designPath, 'design path');
  const note = repositoryRelativePath(repositoryRoot, goNotePath, 'GO note path');
  if (!note.relative.startsWith('notes/')) throw new Error('GO note path must be under notes/');
  if (!Number.isFinite(spendCap) || spendCap < 0) throw new Error('spend cap must be a non-negative number');

  const resolvedLaunchCommit = resolveCommit(repositoryRoot, launchCommit, 'launch commit');
  const headCommit = resolveCommit(repositoryRoot, 'HEAD', 'HEAD');
  if (headCommit !== resolvedLaunchCommit) {
    throw new Error(`launch commit drift: expected ${resolvedLaunchCommit}, found ${headCommit}`);
  }
  if (git(repositoryRoot, ['status', '--porcelain=v1', '--untracked-files=all']).trim()) {
    throw new Error('paid study launch requires a clean checkout');
  }
  try {
    const branch = git(repositoryRoot, ['symbolic-ref', '-q', '--short', 'HEAD']).trim();
    if (branch) throw new Error(`paid study launch requires detached HEAD, found ${branch}`);
  } catch (error) {
    if (error?.status !== 1) throw error;
  }

  let committedDesign;
  try {
    committedDesign = git(repositoryRoot, ['show', `${resolvedLaunchCommit}:${design.relative}`], { encoding: null });
  } catch {
    throw new Error(`launch commit does not contain design file ${design.relative}`);
  }
  const onDiskDesign = fs.readFileSync(design.absolute);
  if (!committedDesign.equals(onDiskDesign)) {
    throw new Error(`launch commit does not contain the checked-out bytes of ${design.relative}`);
  }
  const resolvedMainCommit = resolveCommit(repositoryRoot, mainRef, 'main ref');
  try {
    git(repositoryRoot, ['merge-base', '--is-ancestor', resolvedLaunchCommit, resolvedMainCommit]);
  } catch {
    throw new Error(`launch commit containing the design must be merged into ${mainRef}`);
  }

  const resolvedGoNoteCommit = resolveCommit(repositoryRoot, goNoteCommit, 'GO note commit');
  try {
    git(repositoryRoot, ['merge-base', '--is-ancestor', resolvedLaunchCommit, resolvedGoNoteCommit]);
  } catch {
    throw new Error('GO note commit must descend from the launch commit');
  }
  let goNoteText;
  try {
    goNoteText = git(repositoryRoot, ['show', `${resolvedGoNoteCommit}:${note.relative}`]);
  } catch {
    throw new Error(`GO note commit does not contain ${note.relative}`);
  }
  const issues = paidStudyGoNoteIssues({
    text: goNoteText,
    designPath: design.relative,
    launchCommit: resolvedLaunchCommit,
    spendCap,
  });
  if (issues.length) throw new Error(`signed GO note does not satisfy the standing contract: ${issues.join(', ')}`);

  return {
    source: {
      commit: resolvedLaunchCommit,
      tree: git(repositoryRoot, ['rev-parse', `${resolvedLaunchCommit}^{tree}`]).trim(),
      detached: true,
      dirty: false,
      main_ref: mainRef,
      main_commit: resolvedMainCommit,
    },
    design: { path: design.relative },
    authorization: { commit: resolvedGoNoteCommit, path: note.relative },
    spend_cap: spendCap,
  };
}

function appendJsonLine(fileDescriptor, event) {
  fs.writeSync(fileDescriptor, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`);
  fs.fsyncSync(fileDescriptor);
}

export function admitPaidStudyLaunch({ destination, ledgerName = 'run-ledger.jsonl', ...contract }) {
  if (!destination || !path.isAbsolute(destination)) throw new Error('destination must be absolute');
  if (path.basename(ledgerName) !== ledgerName || !ledgerName.endsWith('.jsonl')) {
    throw new Error('ledger name must be a JSONL filename');
  }
  const verified = verifyPaidStudyLaunchContract(contract);
  if (fs.existsSync(destination)) throw new Error('paid study destination is create-once');

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.mkdirSync(destination, { recursive: false });
  const ledgerPath = path.join(destination, ledgerName);
  const ledger = fs.openSync(ledgerPath, 'ax');
  let reserved = 0;
  let closed = false;
  const ensureOpen = () => {
    if (closed) throw new Error('paid study run ledger is closed');
  };
  appendJsonLine(ledger, {
    type: 'launch_admitted',
    source_commit: verified.source.commit,
    source_tree: verified.source.tree,
    design_path: verified.design.path,
    go_note: verified.authorization,
    spend_cap: verified.spend_cap,
  });

  return {
    ...verified,
    destination,
    ledger_path: ledgerPath,
    get reserved() {
      return reserved;
    },
    reserveModelAttempts(count = 1, detail = {}) {
      ensureOpen();
      if (!Number.isInteger(count) || count < 1)
        throw new Error('model-attempt reservation must be a positive integer');
      if (reserved + count > verified.spend_cap) {
        appendJsonLine(ledger, {
          ...detail,
          type: 'model_attempt_reservation_rejected',
          requested: count,
          reserved,
          spend_cap: verified.spend_cap,
        });
        throw new Error(`paid study spend cap exceeded before call: ${reserved + count}/${verified.spend_cap}`);
      }
      reserved += count;
      appendJsonLine(ledger, {
        ...detail,
        type: 'model_attempt_reserved',
        count,
        reserved,
        spend_cap: verified.spend_cap,
      });
      return { reserved, remaining: verified.spend_cap - reserved };
    },
    record(event) {
      ensureOpen();
      if (!event || typeof event !== 'object' || Array.isArray(event) || !event.type) {
        throw new Error('ledger event must be an object with a type');
      }
      appendJsonLine(ledger, event);
    },
    close(event = { type: 'launcher_closed' }) {
      if (closed) return;
      appendJsonLine(ledger, event);
      fs.closeSync(ledger);
      closed = true;
    },
  };
}
