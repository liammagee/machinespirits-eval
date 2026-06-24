#!/usr/bin/env node
/**
 * workplan.js — the CLI surface for the project's working board (workplan/).
 *
 * Source of truth: workplan/items/<slug>.md (markdown + YAML frontmatter).
 * BOARD.md and board.json are GENERATED here and must never be hand-edited.
 * Contract + schema + playbook: workplan/README.md.
 *
 * Commands:
 *   list [--status S] [--type T] [--owner O] [--priority P] [--blocked] [--json]
 *   show <id>
 *   add [--inbox] --title "…" [--type T] [--priority P] [--owner O] [--source S] [--verification "…"]
 *   triage <inbox-file> [--type T] [--priority P] [--owner O] [--verification "…"]
 *   set <id> <field> <value> [--owner O] [--branch B]
 *   validate                 # frontmatter ⇄ schema/item.schema.json (exit 1 on failure)
 *   render                   # regenerate BOARD.md + board.json
 *   check                    # validate items and verify generated board files are current
 *   ingest [--todo] [--daily]# pull open TODO.md items + daily-notes actions → inbox/
 *
 * Paths are env-overridable for hermetic tests:
 *   WORKPLAN_DIR (default <repo>/workplan), TODO_PATH (default <repo>/TODO.md),
 *   DAILY_NOTES_DIR (default <repo>/notes/daily-notes).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

export const LIFECYCLE = ['inbox', 'triaged', 'active', 'blocked', 'review', 'done', 'archived', 'dropped'];
// Mirror workplan/schema/item.schema.json enums (kept here for the dashboard's
// forms + endpoint validation). Keep in sync with the schema.
export const TYPES = ['experiment', 'infra', 'maintenance', 'research', 'paper', 'content', 'ops'];
export const PRIORITIES = ['P0', 'P1', 'P2', 'P3'];
export const OWNERS = ['human', 'claude', 'codex', 'gemini', 'unassigned'];
const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 };
const SELF_WORK_ARXIV_IDS = new Set(['2603.10450']);
const SELF_WORK_PATTERNS = [/\bLiam\s+Magee\b/i, /\bMachine\s+Spirits\b/i];

// ---- paths (lazy, env-overridable) ----------------------------------------
function paths() {
  const dir = process.env.WORKPLAN_DIR ? path.resolve(process.env.WORKPLAN_DIR) : path.join(ROOT, 'workplan');
  return {
    dir,
    items: path.join(dir, 'items'),
    inbox: path.join(dir, 'inbox'),
    schema: path.join(dir, 'schema', 'item.schema.json'),
    boardMd: path.join(dir, 'BOARD.md'),
    boardJson: path.join(dir, 'board.json'),
    todo: process.env.TODO_PATH ? path.resolve(process.env.TODO_PATH) : path.join(ROOT, 'TODO.md'),
    dailyNotes: process.env.DAILY_NOTES_DIR
      ? path.resolve(process.env.DAILY_NOTES_DIR)
      : path.join(ROOT, 'notes', 'daily-notes'),
  };
}

// ---- small helpers ---------------------------------------------------------
function today() {
  return new Date().toISOString().slice(0, 10);
}
function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 60)
    .replace(/-+$/, ''); // truncation at 60 can re-introduce a trailing hyphen
}
function fail(msg) {
  console.error(`workplan: ${msg}`);
  process.exit(1);
}
function rel(p) {
  return path.relative(ROOT, p) || p;
}
function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

/** Split a markdown file into {fm, body}. fm is the parsed YAML object. */
function parseDoc(text) {
  if (!text.startsWith('---')) return { fm: {}, body: text };
  const end = text.indexOf('\n---', 3);
  if (end === -1) return { fm: {}, body: text };
  const yamlText = text.slice(3, end).replace(/^\n/, '');
  const body = text.slice(end + 4).replace(/^\n/, '');
  let fm = {};
  try {
    fm = YAML.parse(yamlText) || {};
  } catch (e) {
    throw new Error(`bad frontmatter: ${e.message}`);
  }
  return { fm, body };
}
function serializeDoc(fm, body) {
  const y = YAML.stringify(fm).trimEnd();
  return `---\n${y}\n---\n\n${(body || '').trimStart()}`;
}

function listMd(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md')
    .map((f) => path.join(dir, f));
}

function loadItems() {
  const p = paths();
  return listMd(p.items).map((file) => {
    const { fm, body } = parseDoc(fs.readFileSync(file, 'utf8'));
    return { file, fm, body };
  });
}

// ---- validation (reads schema/item.schema.json as source of truth) --------
function loadSchema() {
  const p = paths();
  if (!fs.existsSync(p.schema)) fail(`schema not found: ${rel(p.schema)}`);
  return JSON.parse(fs.readFileSync(p.schema, 'utf8'));
}
function validateItem(fm, file, schema) {
  const errors = [];
  const props = schema.properties || {};
  for (const req of schema.required || []) {
    if (fm[req] === undefined || fm[req] === null || fm[req] === '') {
      errors.push(`missing required field: ${req}`);
    }
  }
  for (const [key, val] of Object.entries(fm)) {
    const spec = props[key];
    if (!spec) {
      if (schema.additionalProperties === false) errors.push(`unknown field: ${key}`);
      continue;
    }
    if (spec.enum && val !== undefined && !spec.enum.includes(val)) {
      errors.push(`field ${key}="${val}" not in [${spec.enum.join(', ')}]`);
    }
    if (spec.pattern && typeof val === 'string' && !new RegExp(spec.pattern).test(val)) {
      errors.push(`field ${key}="${val}" fails pattern ${spec.pattern}`);
    }
  }
  // id must match filename
  const base = path.basename(file, '.md');
  if (fm.id && fm.id !== base) errors.push(`id "${fm.id}" != filename "${base}"`);
  // conditional: blocked ⇒ blocked_by
  if (fm.status === 'blocked' && !fm.blocked_by) {
    errors.push('status is "blocked" but blocked_by is missing');
  }
  return errors;
}

// ---- commands --------------------------------------------------------------
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

function cmdList(argv) {
  const f = flags(argv);
  let items = loadItems().map((i) => i.fm);
  if (f.status) items = items.filter((i) => i.status === f.status);
  if (f.blocked) items = items.filter((i) => i.status === 'blocked');
  if (f.type) items = items.filter((i) => i.type === f.type);
  if (f.owner) items = items.filter((i) => i.owner === f.owner);
  if (f.priority) items = items.filter((i) => i.priority === f.priority);
  if (f.json) {
    console.log(JSON.stringify(items, null, 2));
    return;
  }
  const byStatus = new Map();
  for (const it of items) {
    if (!byStatus.has(it.status)) byStatus.set(it.status, []);
    byStatus.get(it.status).push(it);
  }
  const order = [
    ...LIFECYCLE.filter((s) => byStatus.has(s)),
    ...[...byStatus.keys()].filter((s) => !LIFECYCLE.includes(s)),
  ];
  if (!items.length) {
    console.log('(no items match)');
    return;
  }
  for (const status of order) {
    const group = byStatus
      .get(status)
      .sort(
        (a, b) =>
          (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9) || String(a.id).localeCompare(b.id),
      );
    console.log(`\n${status.toUpperCase()} (${group.length})`);
    for (const it of group) {
      const extra = [it.type, it.owner, it.claim_status].filter(Boolean).join(' · ');
      const blocked = it.blocked_by ? `  ⟂ ${it.blocked_by}` : '';
      console.log(`  [${it.priority}] ${it.id} — ${it.title}  (${extra})${blocked}`);
    }
  }
  console.log('');
}

function cmdShow(argv) {
  const id = argv[0];
  if (!id) fail('usage: show <id>');
  const p = paths();
  const file = path.join(p.items, `${id}.md`);
  if (!fs.existsSync(file)) fail(`no item: ${id}`);
  console.log(fs.readFileSync(file, 'utf8'));
}

// Create a new item in items/ (the non-inbox path of `add`). Shared by the CLI and
// the dashboard's add endpoint. Returns the new frontmatter (including the slug id).
export function addItem(
  { title, type, priority, owner, source, status, verification, body, depends_on, milestone } = {},
  { render = true } = {},
) {
  if (!title || !String(title).trim()) throw new Error('title is required');
  const p = paths();
  ensureDir(p.items);
  const slug = slugify(title);
  let id = slug;
  let n = 2;
  while (fs.existsSync(path.join(p.items, `${id}.md`))) id = `${slug}-${n++}`;
  const fm = {
    id,
    title: String(title).trim(),
    status: status || 'triaged',
    type: type || 'maintenance',
    priority: priority || 'P2',
    owner: owner || 'unassigned',
    source: source || 'manual',
    created: today(),
    updated: today(),
    verification: verification || 'TODO: state how completion is checked',
  };
  if (Array.isArray(depends_on) && depends_on.length) fm.depends_on = depends_on;
  if (milestone) fm.milestone = milestone;
  fs.writeFileSync(
    path.join(p.items, `${id}.md`),
    serializeDoc(fm, body || 'Context. Link out for detail; do not copy.\n'),
  );
  if (render) renderBoard();
  return fm;
}

// Delete an item from items/. Shared by the dashboard's delete endpoint.
export function deleteItem(id, { render = true } = {}) {
  const p = paths();
  const file = path.join(p.items, `${id}.md`);
  if (!fs.existsSync(file)) throw new Error(`no item: ${id}`);
  fs.rmSync(file);
  if (render) renderBoard();
  return { id };
}

// ---- milestones (workplan/milestones.yaml) ---------------------------------
function milestonesPath() {
  return path.join(paths().dir, 'milestones.yaml');
}
export function loadMilestones() {
  const f = milestonesPath();
  if (!fs.existsSync(f)) return [];
  try {
    const d = YAML.parse(fs.readFileSync(f, 'utf8'));
    return Array.isArray(d && d.milestones) ? d.milestones : [];
  } catch {
    return [];
  }
}
function saveMilestones(list) {
  fs.writeFileSync(milestonesPath(), YAML.stringify({ milestones: list }));
}
// Create or update a milestone (keyed by id; slug of title when absent). Returns it.
export function upsertMilestone(ms) {
  if (!ms || !ms.title || !String(ms.title).trim()) throw new Error('milestone title is required');
  const list = loadMilestones();
  const id = ms.id || slugify(ms.title);
  const i = list.findIndex((m) => m.id === id);
  const merged = { ...(i >= 0 ? list[i] : {}), ...ms, id, title: String(ms.title).trim() };
  if (i >= 0) list[i] = merged;
  else list.push(merged);
  saveMilestones(list);
  return merged;
}
export function deleteMilestone(id) {
  const list = loadMilestones();
  const next = list.filter((m) => m.id !== id);
  if (next.length === list.length) throw new Error(`no milestone: ${id}`);
  saveMilestones(next);
  return { id };
}

function cmdAdd(argv) {
  const f = flags(argv);
  if (!f.title) fail('usage: add [--inbox] --title "…" [--type T] [--priority P] [--owner O] [--source S]');
  const p = paths();
  if (f.inbox) {
    ensureDir(p.inbox);
    const file = path.join(p.inbox, `${today()}-${slugify(f.title)}.md`);
    if (fs.existsSync(file)) fail(`inbox file exists: ${rel(file)}`);
    const fm = {
      title: f.title,
      source: f.source || 'manual',
      created: today(),
      suggested_type: f.type || 'research',
    };
    fs.writeFileSync(file, serializeDoc(fm, 'One short paragraph: what the idea is and why it might matter.\n'));
    console.log(`captured → ${rel(file)}  (triage it into items/ when ready)`);
    return;
  }
  let fm;
  try {
    fm = addItem(
      {
        title: f.title,
        type: f.type,
        priority: f.priority,
        owner: f.owner,
        source: f.source,
        verification: f.verification,
      },
      { render: false },
    );
  } catch (e) {
    fail(e.message);
  }
  console.log(`created → ${rel(path.join(p.items, `${fm.id}.md`))}`);
  if (!f.verification) console.log('  ! set a real `verification` before this can reach done');
  autoRender(f);
}

function cmdTriage(argv) {
  const f = flags(argv);
  const src = f._[0];
  if (!src) fail('usage: triage <inbox-file> [--type T] [--priority P] [--owner O] [--verification "…"]');
  const p = paths();
  const inboxFile = path.isAbsolute(src) ? src : path.join(ROOT, src);
  if (!fs.existsSync(inboxFile)) fail(`no such inbox file: ${src}`);
  const { fm: cap, body } = parseDoc(fs.readFileSync(inboxFile, 'utf8'));
  const id = slugify(cap.title || path.basename(inboxFile, '.md'));
  const target = path.join(p.items, `${id}.md`);
  if (fs.existsSync(target)) fail(`item already exists: ${id}`);
  const fm = {
    id,
    title: cap.title || id,
    status: 'triaged',
    type: f.type || cap.suggested_type || 'research',
    priority: f.priority || 'P2',
    owner: f.owner || 'unassigned',
    source: cap.source || 'daily-routine',
    created: cap.created || today(),
    updated: today(),
    verification: f.verification || 'TODO: state how completion is checked',
  };
  if (cap.links) fm.links = cap.links;
  ensureDir(p.items);
  fs.writeFileSync(target, serializeDoc(fm, body));
  fs.rmSync(inboxFile);
  console.log(`triaged → ${rel(target)} (removed ${rel(inboxFile)})`);
  if (!f.verification) console.log('  ! set a real `verification` (and priority/owner) before this can reach done');
  autoRender(f);
}

// Shared write core: read an item, mutate its frontmatter, stamp `updated`, write,
// and (by default) re-render the board. The CLI `set`, drag-and-drop, and the
// board's edit form all funnel through this so items/, board.json, and the
// dashboard never disagree. Throws on a missing item.
function writeItem(id, mutate, render) {
  const p = paths();
  const file = path.join(p.items, `${id}.md`);
  if (!fs.existsSync(file)) throw new Error(`no item: ${id}`);
  const { fm, body } = parseDoc(fs.readFileSync(file, 'utf8'));
  mutate(fm);
  fm.updated = today();
  fs.writeFileSync(file, serializeDoc(fm, body));
  if (render) renderBoard();
  return fm;
}

// Set one field (empty value = leave unchanged). Used by `set` + drag-and-drop.
export function setItemField(id, field, value, { owner, branch, render = true } = {}) {
  return writeItem(
    id,
    (fm) => {
      if (value !== undefined && value !== '') fm[field] = value;
      if (owner) fm.owner = owner;
      if (branch) fm.branch = branch;
    },
    render,
  );
}

// Set several fields at once (empty/null = clear the field). Used by the board's
// edit form; callers validate that required fields are non-empty first.
export function updateItem(id, fields, { render = true } = {}) {
  return writeItem(
    id,
    (fm) => {
      for (const [k, v] of Object.entries(fields || {})) {
        if (v === undefined) continue;
        if (v === '' || v === null || (Array.isArray(v) && v.length === 0)) delete fm[k];
        else fm[k] = v;
      }
    },
    render,
  );
}

// Validate a proposed depends_on for an item against the current set (keyed by id):
// each dependency must exist, no self-dependency, and no cycle. Returns an error
// string, or null when valid. Pure — used by the board endpoints + unit-tested.
export function validateDependencies(itemsById, id, deps) {
  if (deps == null) return null;
  if (!Array.isArray(deps)) return 'depends_on must be a list of item ids';
  for (const d of deps) {
    if (typeof d !== 'string' || !d) return 'each dependency must be an item id';
    if (d === id) return 'an item cannot depend on itself';
    if (!itemsById[d]) return `unknown dependency: ${d}`;
  }
  const reaches = (start, target, seen) => {
    if (start === target) return true;
    if (seen.has(start)) return false;
    seen.add(start);
    return ((itemsById[start] && itemsById[start].depends_on) || []).some((nd) => reaches(nd, target, seen));
  };
  for (const d of deps) {
    if (reaches(d, id, new Set())) return `dependency cycle via ${d}`;
  }
  return null;
}

function cmdSet(argv) {
  const f = flags(argv);
  const [id, field, ...rest] = f._;
  if (!id || !field) fail('usage: set <id> <field> <value> [--owner O] [--branch B]');
  const value = rest.join(' ');
  let fm;
  try {
    fm = setItemField(id, field, value, { owner: f.owner, branch: f.branch, render: false });
  } catch (e) {
    fail(e.message);
  }
  if (fm.status === 'blocked' && !fm.blocked_by) {
    console.log('  ! status is blocked but blocked_by is empty — set it: set ' + id + ' blocked_by "…"');
  }
  console.log(`updated ${id}: ${field}=${value || '(unchanged)'} updated=${fm.updated}`);
  autoRender(f);
}

function validateItems() {
  const schema = loadSchema();
  const items = loadItems();
  const failures = [];
  for (const { file, fm } of items) {
    const errors = validateItem(fm, file, schema);
    if (errors.length) failures.push({ file, errors });
  }
  return { items, failures };
}

function printValidationResult(result) {
  for (const { file, errors } of result.failures) {
    console.log(`✗ ${rel(file)}`);
    for (const e of errors) console.log(`    - ${e}`);
  }
  console.log(`\n${result.items.length - result.failures.length}/${result.items.length} items valid`);
}

function cmdValidate() {
  const result = validateItems();
  printValidationResult(result);
  if (result.failures.length) process.exit(1);
}

function buildBoardCore() {
  const items = loadItems().map((i) => i.fm);
  const counts = { total: items.length, byStatus: {}, byType: {} };
  for (const it of items) {
    counts.byStatus[it.status] = (counts.byStatus[it.status] || 0) + 1;
    counts.byType[it.type] = (counts.byType[it.type] || 0) + 1;
  }
  return {
    counts,
    items: items
      .slice()
      .sort(
        (a, b) =>
          LIFECYCLE.indexOf(a.status) - LIFECYCLE.indexOf(b.status) ||
          (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9) ||
          String(a.id).localeCompare(b.id),
      ),
  };
}

function sameBoardCore(a, b) {
  return JSON.stringify({ counts: a.counts, items: a.items }) === JSON.stringify({ counts: b.counts, items: b.items });
}

function readBoardJson(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function boardMarkdown(board) {
  const { counts } = board;
  const lines = [];
  lines.push('<!-- GENERATED by scripts/workplan.js render — do not edit. Source: workplan/items/ -->');
  lines.push('# Board');
  lines.push('');
  lines.push(`_${counts.total} items · generated ${board.generated}_`);
  lines.push('');
  const summary = LIFECYCLE.filter((s) => counts.byStatus[s])
    .map((s) => `${s} ${counts.byStatus[s]}`)
    .join(' · ');
  lines.push(summary || '(empty)');
  for (const status of LIFECYCLE) {
    const group = board.items.filter((i) => i.status === status);
    if (!group.length) continue;
    lines.push('');
    lines.push(`## ${status} (${group.length})`);
    for (const it of group) {
      const tags = [it.type, it.owner, it.claim_status].filter(Boolean).join(' · ');
      let line = `- **[${it.priority}] ${it.id}** — ${it.title}  · ${tags}`;
      if (it.blocked_by) line += `  · blocked: ${it.blocked_by}`;
      lines.push(line);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function buildBoardDocuments(generated) {
  const core = buildBoardCore();
  const board = { generated, ...core };
  return {
    board,
    json: JSON.stringify(board, null, 2) + '\n',
    markdown: boardMarkdown(board),
  };
}

function generatedTimestampForRender(p, core) {
  if (process.env.WORKPLAN_RENDERED_AT) return process.env.WORKPLAN_RENDERED_AT;
  const existing = readBoardJson(p.boardJson);
  if (existing && existing.generated && sameBoardCore(existing, core)) return existing.generated;
  return new Date().toISOString();
}

export function renderBoard() {
  const p = paths();
  const core = buildBoardCore();
  const generated = generatedTimestampForRender(p, core);
  const board = { generated, ...core };
  fs.writeFileSync(p.boardJson, JSON.stringify(board, null, 2) + '\n');
  fs.writeFileSync(p.boardMd, boardMarkdown(board));
  return core.counts;
}

function cmdCheck() {
  const validation = validateItems();
  printValidationResult(validation);
  const errors = [];
  if (validation.failures.length) errors.push('fix invalid item frontmatter');

  const p = paths();
  const actualBoard = readBoardJson(p.boardJson);
  if (!actualBoard) {
    errors.push(`${rel(p.boardJson)} is missing or invalid; run npm run wp:render`);
  }
  const generated =
    actualBoard && actualBoard.generated ? actualBoard.generated : process.env.WORKPLAN_RENDERED_AT || '';
  const expected = buildBoardDocuments(generated);
  if (!fs.existsSync(p.boardJson) || fs.readFileSync(p.boardJson, 'utf8') !== expected.json) {
    errors.push(`${rel(p.boardJson)} is stale; run npm run wp:render`);
  }
  if (!fs.existsSync(p.boardMd) || fs.readFileSync(p.boardMd, 'utf8') !== expected.markdown) {
    errors.push(`${rel(p.boardMd)} is stale; run npm run wp:render`);
  }

  if (errors.length) {
    console.log('');
    for (const e of errors) console.log(`workplan check: ${e}`);
    process.exit(1);
  }
  console.log(`\nworkplan check passed (${expected.board.counts.total} items)`);
}

function cmdRender() {
  const c = renderBoard();
  const p = paths();
  console.log(`rendered ${rel(p.boardMd)} + ${rel(p.boardJson)} (${c.total} items)`);
}

// Mutating commands (add/triage/set) call this so BOARD.md + board.json — and the
// dashboard that reads board.json — never drift from items/. Pass --no-render to
// skip it in batch scripts.
function autoRender(f) {
  if (f && f['no-render']) return;
  const c = renderBoard();
  console.log(`  board refreshed (${c.total} items)`);
}

// ---- ingest ----------------------------------------------------------------
function trackedTokens() {
  // strings already referenced anywhere in items/ or inbox/ (for dedup)
  const p = paths();
  const blob = [...listMd(p.items), ...listMd(p.inbox)].map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  return blob;
}

function ingestTodo() {
  const p = paths();
  if (!fs.existsSync(p.todo)) {
    console.log('ingest --todo: no TODO.md, skipping');
    return;
  }
  const text = fs.readFileSync(p.todo, 'utf8');
  const lines = text.split('\n');
  const tracked = trackedTokens();
  const CLOSED = /\bRESOLVED\b|\bCLOSED\b|\(COMPLETE\)|—\s*COMPLETE|null result|\bdeprecated\b|~~/i;
  const headRe = /^###\s+([A-Z]\d+[a-z]?)\.\s+(.+)$/;
  let open = 0,
    closed = 0,
    already = 0,
    wrote = 0;
  ensureDir(p.inbox);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(headRe);
    if (!m) continue;
    const [, code, rawTitle] = m;
    // section body until next ### or ##
    let j = i + 1;
    const body = [];
    while (j < lines.length && !/^###?\s/.test(lines[j])) body.push(lines[j++]);
    const blob = rawTitle + '\n' + body.join('\n');
    if (CLOSED.test(rawTitle) || CLOSED.test(blob)) {
      closed++;
      continue;
    }
    open++;
    if (new RegExp(`§\\s*${code}\\b`, 'i').test(tracked) || tracked.includes(`todo-${code.toLowerCase()}`)) {
      already++;
      continue;
    }
    const title = rawTitle
      .replace(/\s*~~.*?~~\s*/g, ' ')
      .replace(/\s*\(.*?\)\s*$/, '')
      .trim();
    const slug = `todo-${code.toLowerCase()}-${slugify(title)}`.slice(0, 60);
    const stype = code.startsWith('A') ? 'experiment' : code.startsWith('D') ? 'research' : 'infra';
    const file = path.join(p.inbox, `${today()}-${slug}.md`);
    if (fs.existsSync(file)) {
      already++;
      continue;
    }
    const fm = {
      title: `${code}. ${title}`,
      source: 'todo',
      created: today(),
      suggested_type: stype,
      links: { notes: 'TODO.md' },
    };
    fs.writeFileSync(
      file,
      serializeDoc(
        fm,
        `Open item from TODO §${code}. Read the section there for detail; triage to decide if it's still live.\n`,
      ),
    );
    wrote++;
  }
  console.log(
    `ingest --todo: ${open} open candidates (${already} already tracked, ${closed} closed) → wrote ${wrote} inbox captures`,
  );
}

// Parse a roundup HTML into per-paper entries. The techne roundup template gives
// each paper a <div class="paper">…</div> block with an <h3> title, an arXiv id
// in <div class="meta">, an optional <span class="flag"> (UNBLOCK/WATCH), and a
// <strong>Project relevance:</strong> paragraph — that relevance line is the action.
function parseRoundupEntries(html) {
  const strip = (s) =>
    (s || '')
      .replace(/<span class="flag[^"]*">[\s\S]*?<\/span>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const entries = [];
  const parts = html.split(/<div class="paper[^"]*">/i).slice(1);
  for (const part of parts) {
    const idM = part.match(/\b(2[0-9]{3}\.[0-9]{4,5})\b/);
    if (!idM) continue;
    const h3 = part.match(/<h3>([\s\S]*?)<\/h3>/i);
    const flagM = part.match(/<span class="flag[^"]*">([\s\S]*?)<\/span>/i);
    const relM = part.match(/Project relevance:\s*<\/strong>([\s\S]*?)<\/p>/i);
    entries.push({
      id: idM[1],
      title: strip(h3 ? h3[1] : ''),
      flag: flagM ? strip(flagM[1]) : '',
      relevance: strip(relM ? relM[1] : ''),
      text: strip(part),
    });
  }
  return entries;
}

function isSelfWorkEntry(entry) {
  if (SELF_WORK_ARXIV_IDS.has(entry.id)) return true;
  const haystack = [entry.title, entry.relevance, entry.text].filter(Boolean).join('\n');
  return SELF_WORK_PATTERNS.some((pattern) => pattern.test(haystack));
}

function ingestDaily() {
  const p = paths();
  if (!fs.existsSync(p.dailyNotes)) {
    console.log('ingest --daily: no daily-notes dir, skipping');
    return;
  }
  const tracked = trackedTokens();
  const trackedIds = new Set(tracked.match(/\b2[0-9]{3}\.[0-9]{4,5}\b/g) || []);
  const files = fs
    .readdirSync(p.dailyNotes)
    .filter((f) => /research-roundup.*\.html$/.test(f))
    .sort();
  ensureDir(p.inbox);
  const seen = new Set();
  let scanned = 0,
    wrote = 0,
    dup = 0,
    self = 0,
    fallback = 0;
  for (const f of files) {
    const html = fs.readFileSync(path.join(p.dailyNotes, f), 'utf8');
    const entries = parseRoundupEntries(html);
    if (!entries.length) {
      // Roundups that don't parse into per-paper entries: one capture per file
      // (deduped by filename) so nothing is silently dropped.
      if (tracked.includes(f)) continue;
      const rdate = (f.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || f;
      const file = path.join(p.inbox, `${today()}-roundup-${rdate}.md`);
      if (fs.existsSync(file)) continue;
      fs.writeFileSync(
        file,
        serializeDoc(
          {
            title: `Triage actions from the ${rdate} research roundup`,
            source: 'daily-routine',
            created: today(),
            suggested_type: 'research',
            links: { notes: `notes/daily-notes/${f}` },
          },
          `This roundup did not parse into per-paper entries; extract its actions manually and triage each.\n`,
        ),
      );
      fallback++;
      wrote++;
      continue;
    }
    for (const en of entries) {
      scanned++;
      if (isSelfWorkEntry(en)) {
        self++;
        continue;
      }
      if (trackedIds.has(en.id) || seen.has(en.id)) {
        dup++;
        continue;
      }
      seen.add(en.id);
      const file = path.join(p.inbox, `${today()}-arxiv-${en.id}.md`);
      if (fs.existsSync(file)) {
        dup++;
        continue;
      }
      const flag = en.flag ? ` [${en.flag}]` : '';
      fs.writeFileSync(
        file,
        serializeDoc(
          {
            title: (en.title || `arXiv ${en.id}`).slice(0, 110),
            source: 'daily-routine',
            created: today(),
            suggested_type: 'research',
            links: { notes: `notes/daily-notes/${f}` },
          },
          `arXiv:${en.id}${flag} — surfaced by the daily routine (${f}).\n\n${en.relevance || 'No project-relevance note captured; read the roundup entry.'}\n\nTriage: promote to a research item (link the paper §) or drop with a reason.`,
        ),
      );
      wrote++;
    }
  }
  console.log(
    `ingest --daily: ${files.length} roundups, ${scanned} paper entries (${dup} dup arxiv-id skipped${self ? `, ${self} self-work skipped` : ''}${fallback ? `, ${fallback} fallback` : ''}) → wrote ${wrote} inbox captures`,
  );
}

function cmdIngest(argv) {
  const f = flags(argv);
  const both = !f.todo && !f.daily;
  if (f.todo || both) ingestTodo();
  if (f.daily || both) ingestDaily();
  console.log('triage the new inbox captures: node scripts/workplan.js list  (then triage <file>)');
}

// ---- dispatch --------------------------------------------------------------
const USAGE = `workplan — the project working board (see workplan/README.md)

  list [--status S|--type T|--owner O|--priority P|--blocked] [--json]
  show <id>
  add [--inbox] --title "…" [--type T --priority P --owner O --source S --verification "…"]
  triage <inbox-file> [--type T --priority P --owner O --verification "…"]
  set <id> <field> <value> [--owner O --branch B]
  validate
  check
  render          (add/triage/set auto-render BOARD.md + board.json; --no-render to skip)
  ingest [--todo] [--daily]`;

function main() {
  const [cmd, ...argv] = process.argv.slice(2);
  switch (cmd) {
    case 'list':
      return cmdList(argv);
    case 'show':
      return cmdShow(argv);
    case 'add':
      return cmdAdd(argv);
    case 'triage':
      return cmdTriage(argv);
    case 'set':
      return cmdSet(argv);
    case 'validate':
      return cmdValidate();
    case 'check':
      return cmdCheck();
    case 'render':
      return cmdRender();
    case 'ingest':
      return cmdIngest(argv);
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      console.log(USAGE);
      return;
    default:
      fail(`unknown command: ${cmd}\n\n${USAGE}`);
  }
}

// Only auto-run as a CLI; stay importable (the dashboard imports setItemField +
// renderBoard) without executing a command.
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
