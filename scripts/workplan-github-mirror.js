#!/usr/bin/env node
/**
 * Mirror selected workplan items to GitHub Issues for visibility.
 *
 * This is intentionally one-way: workplan/items/ remains authoritative. By
 * default the script is a dry run. Pass --apply to create/update GitHub issues.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import YAML from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const MARKER_RE = /<!--\s*workplan-id:\s*([a-z0-9][a-z0-9-]*[a-z0-9])\s*-->/i;

function fail(message) {
  console.error(`workplan-github-mirror: ${message}`);
  process.exit(1);
}

function flags(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    } else out._.push(a);
  }
  return out;
}

function runGh(args, { input } = {}) {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const r = spawnSync('gh', args, {
    encoding: 'utf8',
    input,
    env: token ? { ...process.env, GH_TOKEN: token } : process.env,
  });
  if (r.error && r.error.code === 'ENOENT') return { missing: true, status: 127, stdout: '', stderr: 'gh not found' };
  return r;
}

function requireGh() {
  const r = runGh(['--version']);
  if (r.missing || r.status !== 0) fail('gh CLI is required for --apply');
}

function workplanDir() {
  return process.env.WORKPLAN_DIR ? path.resolve(process.env.WORKPLAN_DIR) : path.join(ROOT, 'workplan');
}

function parseDoc(text) {
  if (!text.startsWith('---')) return {};
  const end = text.indexOf('\n---', 3);
  if (end === -1) return {};
  return YAML.parse(text.slice(3, end).replace(/^\n/, '')) || {};
}

function loadItems(statuses) {
  const itemsDir = path.join(workplanDir(), 'items');
  if (!fs.existsSync(itemsDir)) return [];
  return fs
    .readdirSync(itemsDir)
    .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md')
    .map((f) => ({ file: path.join(itemsDir, f), fm: parseDoc(fs.readFileSync(path.join(itemsDir, f), 'utf8')) }))
    .filter(({ fm }) => statuses.has(fm.status))
    .sort((a, b) => String(a.fm.id).localeCompare(String(b.fm.id)));
}

function issueTitle(item) {
  return `[workplan] ${item.id}: ${item.title}`;
}

function issueBody(item) {
  const lines = [
    `<!-- workplan-id: ${item.id} -->`,
    '',
    `Mirrors \`workplan/items/${item.id}.md\` for GitHub visibility.`,
    '',
    `Source of truth: edit \`workplan/items/${item.id}.md\`, then run \`npm run wp:render\`.`,
    '',
    `Status: \`${item.status}\``,
    `Priority: \`${item.priority}\``,
    `Type: \`${item.type}\``,
    `Owner: \`${item.owner}\``,
  ];
  if (item.branch) lines.push(`Branch: \`${item.branch}\``);
  if (item.blocked_by) lines.push(`Blocked by: ${item.blocked_by}`);
  if (item.verification) lines.push('', `Verification: ${item.verification}`);
  if (item.links && Object.keys(item.links).length) {
    lines.push('', 'Links:');
    for (const [key, value] of Object.entries(item.links)) {
      const rendered = typeof value === 'string' ? value : JSON.stringify(value);
      lines.push(`- ${key}: ${rendered}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function fetchOpenMirrorIssues({ requireRemote = false } = {}) {
  const r = runGh(['issue', 'list', '--state', 'open', '--limit', '200', '--json', 'number,title,body']);
  if (r.missing) return { missingGh: true, issues: [] };
  if (r.status !== 0) {
    if (requireRemote) fail(`gh issue list failed: ${r.stderr || r.stdout}`);
    return { remoteError: String(r.stderr || r.stdout).trim(), issues: [] };
  }
  const all = JSON.parse(r.stdout || '[]');
  return {
    missingGh: false,
    remoteError: null,
    issues: all
      .map((issue) => {
        const m = String(issue.body || '').match(MARKER_RE);
        return m ? { ...issue, workplanId: m[1] } : null;
      })
      .filter(Boolean),
  };
}

function writeTemp(text) {
  const file = path.join(os.tmpdir(), `workplan-issue-${process.pid}-${Math.random().toString(16).slice(2)}.md`);
  fs.writeFileSync(file, text);
  return file;
}

function applyIssue(action, item, existing) {
  const bodyFile = writeTemp(issueBody(item));
  const title = issueTitle(item);
  try {
    const args =
      action === 'create'
        ? ['issue', 'create', '--title', title, '--body-file', bodyFile]
        : ['issue', 'edit', String(existing.number), '--title', title, '--body-file', bodyFile];
    const r = runGh(args);
    if (r.status !== 0) fail(`gh issue ${action} failed for ${item.id}: ${r.stderr || r.stdout}`);
    process.stdout.write(r.stdout);
  } finally {
    fs.rmSync(bodyFile, { force: true });
  }
}

function closeIssue(issue) {
  const r = runGh(['issue', 'close', String(issue.number), '--comment', 'No longer mirrored: source workplan item is not in the selected mirror statuses.']);
  if (r.status !== 0) fail(`gh issue close failed for ${issue.workplanId}: ${r.stderr || r.stdout}`);
  process.stdout.write(r.stdout);
}

function main() {
  const opts = flags(process.argv.slice(2));
  const statuses = new Set(String(opts.status || 'active,blocked').split(',').map((s) => s.trim()).filter(Boolean));
  const apply = Boolean(opts.apply);
  const closeStale = Boolean(opts['close-stale']);
  if (apply) requireGh();

  const items = loadItems(statuses).map(({ fm }) => fm);
  const desired = new Map(items.map((item) => [item.id, item]));
  const remote = fetchOpenMirrorIssues({ requireRemote: apply });
  const existing = new Map(remote.issues.map((issue) => [issue.workplanId, issue]));

  if (remote.missingGh && !apply) {
    console.log('gh CLI not found; dry run will list desired mirror issues only.');
  }
  if (remote.remoteError && !apply) {
    console.log(`could not read existing GitHub issues; dry run will list desired mirror issues only: ${remote.remoteError}`);
  }

  let creates = 0;
  let updates = 0;
  for (const item of items) {
    const prior = existing.get(item.id);
    const title = issueTitle(item);
    const body = issueBody(item);
    if (!prior) {
      creates++;
      console.log(`[create] ${title}`);
      if (apply) applyIssue('create', item);
      continue;
    }
    if (prior.title !== title || String(prior.body || '') !== body) {
      updates++;
      console.log(`[update] #${prior.number} ${title}`);
      if (apply) applyIssue('update', item, prior);
    } else {
      console.log(`[ok] #${prior.number} ${title}`);
    }
  }

  const stale = remote.issues.filter((issue) => !desired.has(issue.workplanId));
  for (const issue of stale) {
    const msg = `[stale] #${issue.number} workplan item ${issue.workplanId} is not in ${[...statuses].join(',')}`;
    console.log(msg);
    if (apply && closeStale) closeIssue(issue);
  }

  const mode = apply ? 'applied' : 'dry run';
  console.log(`${mode}: ${items.length} desired mirror issues, ${creates} creates, ${updates} updates, ${stale.length} stale`);
}

main();
