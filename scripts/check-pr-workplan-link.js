#!/usr/bin/env node
/**
 * Check that a pull request body names a workplan item or explicitly says N/A.
 *
 * Source of truth stays in workplan/items/. This script only validates that the
 * GitHub PR points back to it. The grammar of a valid link lives in
 * scripts/lib/workplanLink.js, shared with the commit-trailer check that covers
 * work pushed straight to main.
 */
import fs from 'node:fs';
import path from 'node:path';
import { findBranchLinkedId, findLinkedId, isUntouchedTemplate, loadKnownItems } from './lib/workplanLink.js';

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
