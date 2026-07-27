/**
 * Shared rules for linking a change back to workplan/items/.
 *
 * Two surfaces read these: `check-pr-workplan-link.js` reads a pull request
 * body, `check-commit-workplan-trailer.js` reads a commit message. The grammar
 * lives here rather than in either caller because a link that is valid on one
 * surface must be valid on the other — otherwise agents learn two rules and
 * follow neither.
 *
 * Source of truth stays in workplan/items/. Nothing here creates or edits a
 * card; it only decides whether some text points at one that already exists.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function workplanDir() {
  return process.env.WORKPLAN_DIR ? path.resolve(process.env.WORKPLAN_DIR) : path.join(ROOT, 'workplan');
}

export function loadKnownItems() {
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
        // malformed item must never become an inferred link here.
      }
    }
    items.set(id, { id, branch });
  }
  return items;
}

/**
 * Every value an author explicitly offered as the link.
 *
 * Accepts `Workplan item:`, the git trailer form `Workplan-item:`, and bare
 * `Workplan:`, each optionally wrapped in a markdown list marker or checkbox.
 * The trailer spelling is here so a commit message written to git's own
 * `--trailer` convention parses identically to a PR body written by hand.
 */
export function explicitWorkplanValues(text) {
  const values = [];
  const re = /^\s*(?:[-*]\s*)?(?:\[[ xX]\]\s*)?(?:linked\s+)?workplan(?:[\s-]+item)?\s*:\s*(.+?)\s*$/gim;
  let m;
  while ((m = re.exec(text))) values.push(m[1].trim());
  return values;
}

export function findLinkedId(text, knownIds) {
  const values = explicitWorkplanValues(text);
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
    if (new RegExp(`\\bworkplan/items/${escaped}\\.md\\b`, 'i').test(text)) {
      return { ok: true, kind: 'id', id };
    }
  }
  return { ok: false, values };
}

export function isUntouchedTemplate(values) {
  return values.length === 0 || values.every((value) => /^<\s*id\s+or\s+n\/a\s*>$/i.test(value));
}

export function findBranchLinkedId(headRef, knownItems) {
  if (!headRef) return { ok: false, reason: 'no PR head branch was available for inference' };
  const matches = [...knownItems.values()].filter((item) => item.branch === headRef);
  if (matches.length === 1) return { ok: true, kind: 'id', id: matches[0].id, headRef };
  if (matches.length === 0) return { ok: false, reason: `branch ${headRef} matches no workplan item` };
  return {
    ok: false,
    reason: `branch ${headRef} matches multiple workplan items: ${matches.map((item) => item.id).join(', ')}`,
  };
}
