#!/usr/bin/env node
/**
 * Sync repo-local agent skills across provider-specific skill roots.
 *
 * The manifest declares intentional mirrors. The script does not try to make
 * every skill identical across every tool; some skills are provider-specific.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_CONFIG = path.join(ROOT, 'config', 'agent-skill-sync.json');

function fail(message) {
  console.error(`skill-sync: ${message}`);
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
        i += 1;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

function resolvePath(p) {
  return path.isAbsolute(p) ? p : path.join(ROOT, p);
}

export function loadConfig(file = process.env.SKILL_SYNC_CONFIG || DEFAULT_CONFIG) {
  const configFile = path.resolve(file);
  if (!fs.existsSync(configFile)) throw new Error(`config not found: ${configFile}`);
  const raw = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  const roots = {};
  for (const [key, value] of Object.entries(raw.roots || {})) roots[key] = resolvePath(value);
  return {
    file: configFile,
    roots,
    mirrors: Array.isArray(raw.mirrors) ? raw.mirrors : [],
  };
}

function skillDir(config, rootKey, name) {
  const root = config.roots[rootKey];
  if (!root) throw new Error(`unknown skill root: ${rootKey}`);
  return path.join(root, name);
}

function hasSkill(dir) {
  return fs.existsSync(path.join(dir, 'SKILL.md'));
}

function listSkillNames(root) {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && hasSkill(path.join(root, d.name)))
    .map((d) => d.name)
    .sort();
}

function rel(p) {
  return path.relative(ROOT, p) || p;
}

export function skillMatrix(config) {
  const rootKeys = Object.keys(config.roots);
  const names = new Set();
  const byRoot = {};
  for (const key of rootKeys) {
    byRoot[key] = new Set(listSkillNames(config.roots[key]));
    for (const name of byRoot[key]) names.add(name);
  }
  return [...names].sort().map((name) => {
    const row = { name };
    for (const key of rootKeys) row[key] = byRoot[key].has(name);
    return row;
  });
}

function listFiles(dir) {
  const out = [];
  const walk = (current, prefix = '') => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(current, entry.name);
      const relative = path.join(prefix, entry.name);
      if (entry.isDirectory()) walk(absolute, relative);
      else if (entry.isFile()) out.push(relative);
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return out;
}

function dirsEqual(a, b) {
  if (!fs.existsSync(a) || !fs.existsSync(b)) return false;
  const af = listFiles(a);
  const bf = listFiles(b);
  if (af.length !== bf.length) return false;
  for (let i = 0; i < af.length; i++) {
    if (af[i] !== bf[i]) return false;
    if (!fs.readFileSync(path.join(a, af[i])).equals(fs.readFileSync(path.join(b, bf[i])))) return false;
  }
  return true;
}

function copyDir(source, target) {
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
}

function selectedMirrors(config, selected = []) {
  const wanted = new Set(selected);
  return config.mirrors.filter((m) => !wanted.size || wanted.has(m.name));
}

export function mirrorStatuses(config, selected = []) {
  const rows = [];
  for (const mirror of selectedMirrors(config, selected)) {
    const source = skillDir(config, mirror.source, mirror.name);
    const sourceExists = hasSkill(source);
    for (const targetRoot of mirror.targets || []) {
      const target = skillDir(config, targetRoot, mirror.name);
      rows.push({
        name: mirror.name,
        sourceRoot: mirror.source,
        targetRoot,
        source,
        target,
        status: !sourceExists ? 'missing-source' : !hasSkill(target) ? 'missing' : dirsEqual(source, target) ? 'same' : 'different',
        reason: mirror.reason || '',
      });
    }
  }
  return rows;
}

function printList(config) {
  const roots = Object.keys(config.roots);
  console.log(['skill', ...roots].join('\t'));
  for (const row of skillMatrix(config)) {
    console.log([row.name, ...roots.map((root) => (row[root] ? 'yes' : '-'))].join('\t'));
  }
}

function printStatus(rows) {
  if (!rows.length) {
    console.log('No mirrors configured.');
    return;
  }
  for (const row of rows) {
    console.log(`${row.status}\t${row.name}\t${row.sourceRoot} -> ${row.targetRoot}\t${rel(row.target)}`);
  }
}

function cmdCheck(config, selected) {
  const rows = mirrorStatuses(config, selected);
  printStatus(rows);
  const bad = rows.filter((r) => r.status !== 'same');
  if (bad.length) fail(`${bad.length} mirror target(s) need sync`);
}

function cmdSync(config, selected, { dryRun = false } = {}) {
  const rows = mirrorStatuses(config, selected);
  printStatus(rows);
  for (const row of rows) {
    if (row.status === 'same') continue;
    if (row.status === 'missing-source') fail(`source missing for ${row.name}: ${rel(row.source)}`);
    if (dryRun) continue;
    copyDir(row.source, row.target);
    console.log(`synced\t${row.name}\t${row.sourceRoot} -> ${row.targetRoot}`);
  }
}

function main() {
  const [cmd = 'list', ...rest] = process.argv.slice(2);
  const f = flags(rest);
  const config = loadConfig(f.config || process.env.SKILL_SYNC_CONFIG || DEFAULT_CONFIG);
  if (cmd === 'list') return printList(config);
  if (cmd === 'check') return cmdCheck(config, f._);
  if (cmd === 'sync') return cmdSync(config, f._, { dryRun: Boolean(f['dry-run']) });
  fail(`unknown command: ${cmd}\nusage: sync-agent-skills.js list|check|sync [skill...] [--dry-run] [--config <file>]`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  try {
    main();
  } catch (err) {
    fail(err.message);
  }
}
