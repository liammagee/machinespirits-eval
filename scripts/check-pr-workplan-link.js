#!/usr/bin/env node
/**
 * Check that a pull request body names a workplan item or explicitly says N/A.
 *
 * Source of truth stays in workplan/items/. This script only validates that the
 * GitHub PR points back to it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

function fail(message) {
  console.error(`workplan-pr-link: ${message}`);
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

function workplanDir() {
  return process.env.WORKPLAN_DIR ? path.resolve(process.env.WORKPLAN_DIR) : path.join(ROOT, 'workplan');
}

function loadKnownItems() {
  const itemsDir = path.join(workplanDir(), 'items');
  if (!fs.existsSync(itemsDir)) return new Map();
  const items = new Map();
  for (const file of fs
    .readdirSync(itemsDir)
    .filter((entry) => entry.endsWith('.md') && entry.toLowerCase() !== 'readme.md')) {
    const id = path.basename(file, '.md');
    const text = fs.readFileSync(path.join(itemsDir, file), 'utf8');
    const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    let branch = null;
    if (frontmatter) {
      try {
        const metadata = YAML.parse(frontmatter[1]);
        if (typeof metadata?.branch === 'string') branch = metadata.branch.trim();
      } catch {
        // The workplan validation step reports malformed item frontmatter. A
        // malformed item must never become an inferred PR link here.
      }
    }
    items.set(id, { id, branch });
  }
  return items;
}

function readPullRequestContext(opts) {
  if (opts['body-file']) {
    return {
      body: fs.readFileSync(path.resolve(opts['body-file']), 'utf8'),
      headRef: typeof opts['head-ref'] === 'string' ? opts['head-ref'].trim() : '',
    };
  }
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) fail('set --body-file or run under a pull_request GitHub event');
  const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  return {
    body: event.pull_request?.body || '',
    headRef: event.pull_request?.head?.ref || '',
  };
}

function explicitWorkplanValues(body) {
  const values = [];
  const re = /^\s*(?:[-*]\s*)?(?:\[[ xX]\]\s*)?(?:linked\s+)?workplan(?:\s+item)?\s*:\s*(.+?)\s*$/gim;
  let m;
  while ((m = re.exec(body))) values.push(m[1].trim());
  return values;
}

function findLinkedId(body, knownIds) {
  const values = explicitWorkplanValues(body);
  for (const raw of values) {
    const value = raw.replace(/^`|`$/g, '').trim();
    if (/^(n\/a|na|none|not applicable)\b/i.test(value)) return { ok: true, kind: 'na' };
    const idFromPath = value.match(/\bworkplan\/items\/([a-z0-9][a-z0-9-]*[a-z0-9])\.md\b/i);
    if (idFromPath && knownIds.has(idFromPath[1])) return { ok: true, kind: 'id', id: idFromPath[1] };
    const candidate = value.match(/\b([a-z0-9][a-z0-9-]{2,}[a-z0-9])\b/i);
    if (candidate && knownIds.has(candidate[1])) return { ok: true, kind: 'id', id: candidate[1] };
  }

  for (const id of knownIds) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\bworkplan/items/${escaped}\\.md\\b`, 'i').test(body)) {
      return { ok: true, kind: 'id', id };
    }
  }
  return { ok: false, values };
}

function isUntouchedTemplate(values) {
  return values.length === 0 || values.every((value) => /^<\s*id\s+or\s+n\/a\s*>$/i.test(value));
}

function findBranchLinkedId(headRef, knownItems) {
  if (!headRef) return { ok: false, reason: 'no PR head branch was available for inference' };
  const matches = [...knownItems.values()].filter((item) => item.branch === headRef);
  if (matches.length === 1) return { ok: true, kind: 'id', id: matches[0].id, headRef };
  if (matches.length === 0) return { ok: false, reason: `branch ${headRef} matches no workplan item` };
  return {
    ok: false,
    reason: `branch ${headRef} matches multiple workplan items: ${matches.map((item) => item.id).join(', ')}`,
  };
}

function main() {
  const opts = flags(process.argv.slice(2));
  const { body, headRef } = readPullRequestContext(opts);
  const knownItems = loadKnownItems();
  const knownIds = new Set(knownItems.keys());
  const result = findLinkedId(body, knownIds);
  if (result.ok) {
    if (result.kind === 'na') console.log('workplan-pr-link: explicit N/A accepted');
    else console.log(`workplan-pr-link: linked ${result.id}`);
    return;
  }

  if (isUntouchedTemplate(result.values)) {
    const inferred = findBranchLinkedId(headRef, knownItems);
    if (inferred.ok) {
      console.log(`workplan-pr-link: linked ${inferred.id} via branch ${inferred.headRef}`);
      return;
    }
    const seen = result.values.length ? ` Saw: ${result.values.join(' | ')}.` : '';
    fail(`PR body has no valid workplan item and ${inferred.reason}.${seen}`);
  }

  const seen = result.values.length ? ` Saw: ${result.values.join(' | ')}` : '';
  fail('PR body must include `Workplan item: <id>` or `Workplan item: N/A` using an item from workplan/items/.' + seen);
}

main();
