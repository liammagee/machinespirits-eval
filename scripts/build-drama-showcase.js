#!/usr/bin/env node
/**
 * build-drama-showcase.js — refresh the committed "drama of the day" pool that
 * the daily research-roundup cloud routine draws from.
 *
 * WHY THIS EXISTS / THE TWO CONSTRAINTS IT WORKS AROUND
 * -----------------------------------------------------
 * 1. The roundup runs as a *cloud routine* on a fresh, shallow checkout with no
 *    database and no transcript files (data/*.db, exports/, and the poetics
 *    transcript dirs are all gitignored). So it cannot read a drama itself — it
 *    can only read what is committed to the repo. This script produces that
 *    committed file: notes/daily-notes/drama-showcase.json.
 * 2. Drama transcript TEXT is ephemeral — it lives in gitignored run dirs that
 *    get pruned, while the poetics_* DB tables keep only metadata + scores. So
 *    the pool EMBEDS the excerpt text inline, as a durable snapshot taken while
 *    the transcript still exists. Once committed, the excerpt survives cleanup,
 *    and the routine never needs the original files.
 *
 * It unions two sources and writes the union (deduped, ranked, capped):
 *   (a) scored DB items  — canonical units that open in the scriptorium via
 *       /browse?itemId=<id>, carry critic scores, but often have no text on disk.
 *   (b) on-disk drama files (exports/<run>/sample/T*.txt, .../transcripts/*.full.md)
 *       — where the text actually is; enriched with the matching DB item's id +
 *       scores when that run has been ingested (so the scriptorium link resolves).
 *
 * The pool is MERGED, not clobbered: entries whose source text is already gone
 * are preserved so the durable snapshots accumulate.
 *
 * DB access is via the `sqlite3` CLI (not better-sqlite3) on purpose: this
 * checkout's better-sqlite3 is frequently rebuilt for Electron's ABI (see
 * CLAUDE.md), which breaks plain `node`. The CLI sidesteps the native-module
 * dance and is already the documented way to poke data/evaluations.db.
 *
 * Usage:
 *   node scripts/build-drama-showcase.js [options]
 *   npm run drama:showcase -- [options]
 *
 * Options:
 *   --db <path>           DB path (default: EVAL_DB_PATH-aware resolution, symlinks followed)
 *   --from-dir <dir>      extra root to scan for drama files (repeatable;
 *                         default: exports/)
 *   --limit <n>           max entries in the pool (default: 16)
 *   --excerpt-turns <n>   turns to include in each excerpt (default: 3)
 *   --out <path>          output pool (default: notes/daily-notes/drama-showcase.json)
 *   --base-url <url>      public scriptorium base (default:
 *                         https://machinespirits.org/poetics; env POETICS_PUBLIC_BASE)
 *   --local-url <url>     local scriptorium base (default: http://127.0.0.1:3466)
 *   --dry-run             print what would be written, don't write
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
// Path resolution only — DB access stays on the sqlite3 CLI (Electron-ABI worktrees).
import { resolveEvaluationDbPath } from '../services/evaluationDataPaths.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

// ---------------------------------------------------------------------------
// args
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const out = {
    db: null, // resolved via resolveEvaluationDbPath (EVAL_DB_PATH-aware)
    fromDirs: [],
    limit: 16,
    excerptTurns: 3,
    out: 'notes/daily-notes/drama-showcase.json',
    baseUrl: process.env.POETICS_PUBLIC_BASE || 'https://machinespirits.org/poetics',
    localUrl: 'http://127.0.0.1:3466',
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--db') out.db = argv[++i];
    else if (a === '--from-dir') out.fromDirs.push(argv[++i]);
    else if (a === '--limit') out.limit = Number.parseInt(argv[++i], 10);
    else if (a === '--excerpt-turns') out.excerptTurns = Number.parseInt(argv[++i], 10);
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--base-url') out.baseUrl = argv[++i];
    else if (a === '--local-url') out.localUrl = argv[++i];
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  if (!out.fromDirs.length) out.fromDirs = ['exports'];
  out.baseUrl = out.baseUrl.replace(/\/+$/, '');
  out.localUrl = out.localUrl.replace(/\/+$/, '');
  return out;
}

// ---------------------------------------------------------------------------
// sqlite3 CLI helpers (graceful when the DB or CLI is absent)
// ---------------------------------------------------------------------------
function resolveDbPath(rel) {
  const abs = path.isAbsolute(rel) ? rel : path.resolve(ROOT, rel);
  try {
    return fs.realpathSync(abs); // follow the data/evaluations.db symlink
  } catch {
    return abs;
  }
}

function haveSqlite3() {
  try {
    execFileSync('sqlite3', ['--version'], { stdio: ['ignore', 'ignore', 'ignore'] });
    return true;
  } catch {
    return false;
  }
}

function sqlJson(dbPath, query) {
  const raw = execFileSync('sqlite3', ['-json', dbPath, query], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
  if (!raw) return [];
  return JSON.parse(raw);
}

// Aggregated, scriptorium-openable DB items keyed by (run basename, tid) so a
// disk-scanned drama can find its canonical id + critic scores when ingested.
function loadDbIndex(dbPath) {
  const rows = sqlJson(
    dbPath,
    `SELECT i.id AS itemId, i.run_id AS runId, r.source_root AS sourceRoot,
            i.tid AS tid, i.drama_id AS dramaId, i.discipline AS discipline,
            i.condition_name AS conditionName,
            i.full_transcript_path AS fullPath, i.sample_path AS samplePath,
            ROUND(AVG(s.rupture), 1) AS rupture,
            ROUND(AVG(s.recontextualization), 1) AS recontextualization,
            ROUND(AVG(s.global_coherence), 1) AS globalCoherence,
            ROUND(AVG(s.stated_insight), 1) AS statedInsight,
            COUNT(s.id) AS nScores,
            MAX(i.created_at) AS createdAt
       FROM poetics_items i
       JOIN poetics_runs r ON r.id = i.run_id
       LEFT JOIN poetics_scores s ON s.item_id = i.id
      GROUP BY i.id`,
  );
  const byRunTid = new Map(); // `${runBasename}::${tid}` -> row
  for (const row of rows) {
    const base = path.basename(row.sourceRoot || row.runId || '');
    byRunTid.set(`${base}::${row.tid}`, row);
  }
  return { rows, byRunTid };
}

// ---------------------------------------------------------------------------
// transcript parsing + excerpt
// ---------------------------------------------------------------------------
const ROLE_RE = /^\s*(?:[*_#>\s]*)([A-Z][A-Za-z0-9 _-]{1,24}?)\s*:\s*(.*)$/s;

function stripSpeechQuotes(t) {
  const s = String(t || '').trim();
  const pairs = [
    ['"', '"'],
    ['“', '”'],
    ["'", "'"],
  ];
  for (const [o, c] of pairs) {
    if (s.length >= o.length + c.length && s.startsWith(o) && s.endsWith(c)) {
      return s.slice(o.length, s.length - c.length).trim();
    }
  }
  return s;
}

// Split a transcript into a STAGE line + ordered role turns. Defensive: tolerates
// the sample format (blank-line-separated `ROLE: "..."`) and lightly-marked
// markdown (`**TUTOR:**`, `> LEARNER:`). Lines it can't classify are appended to
// the previous turn so nothing is silently dropped.
function parseTranscript(text) {
  const paras = String(text || '')
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  let stage = '';
  const turns = [];
  for (const para of paras) {
    const m = para.match(ROLE_RE);
    if (m) {
      const role = m[1].trim().toUpperCase();
      const body = m[2].trim();
      if (role === 'STAGE' || role === 'SETTING' || role === 'SCENE') {
        if (!stage) stage = body;
        continue;
      }
      turns.push({ role, text: stripSpeechQuotes(body) });
    } else if (turns.length) {
      turns[turns.length - 1].text += ` ${para}`;
    } else if (!stage) {
      stage = para;
    }
  }
  return { stage, turns };
}

function clip(s, max) {
  const t = String(s || '')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

function buildExcerpt({ stage, turns }, { turnsWanted, perTurn = 240, stageMax = 180 }) {
  const lines = [];
  if (stage) lines.push(`STAGE: ${clip(stage, stageMax)}`);
  for (const turn of turns.slice(0, turnsWanted)) {
    lines.push(`${turn.role}: ${clip(turn.text, perTurn)}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// disk scan
// ---------------------------------------------------------------------------
function walk(dir, acc, depth = 0) {
  if (depth > 8) return acc;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.git') continue;
      walk(full, acc, depth + 1);
    } else if (ent.isFile()) {
      const inSample = /[/\\]sample[/\\]/.test(full) && /^T\d+\.txt$/.test(ent.name);
      if (/\.full\.md$/.test(ent.name) || inSample) acc.push(full);
    }
  }
  return acc;
}

// `exports/<...>/<runDir>/sample/T01.txt` -> { runDir, runBasename, tid }
function dramaFileMeta(absPath) {
  const rel = path.relative(ROOT, absPath);
  const tid = (path.basename(absPath).match(/^(T\d+)/) || [])[1] || path.basename(absPath).replace(/\.[^.]+$/, '');
  // run dir is the parent of `sample/` or `transcripts/`
  let dir = path.dirname(absPath);
  if (/[/\\](sample|transcripts)$/.test(dir)) dir = path.dirname(dir);
  const runDir = path.relative(ROOT, dir);
  return { rel, runDir, runBasename: path.basename(runDir), tid };
}

function readMetadata(runDirAbs) {
  const p = path.join(runDirAbs, 'generation-metadata.json');
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// entry assembly
// ---------------------------------------------------------------------------
function humanize(s) {
  return String(s || '')
    .replace(/^D_/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function scoresOf(dbRow) {
  if (!dbRow || !dbRow.nScores) return null;
  return {
    rupture: dbRow.rupture,
    recontextualization: dbRow.recontextualization,
    global_coherence: dbRow.globalCoherence,
    stated_insight: dbRow.statedInsight,
    critics: dbRow.nScores,
  };
}

function compositeOf(scores) {
  if (!scores) return 0;
  const vals = [scores.rupture, scores.recontextualization, scores.global_coherence, scores.stated_insight].filter(
    (v) => typeof v === 'number',
  );
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

// Dedup key must be STABLE across ingest: an entry's itemId is null before its run
// is ingested and set afterwards, so keying on itemId would let the pre- and
// post-ingest copies coexist. runDir+tid identifies the drama on disk regardless.
function entryKey(e) {
  return `${e.runDir || e.runId || ''}::${e.tid || ''}`;
}

function buildEntry({ absPath, opts, dbIndex, capturedAt }) {
  const text = fs.readFileSync(absPath, 'utf8');
  if (!text.trim()) return null;
  const parsed = parseTranscript(text);
  if (!parsed.turns.length) return null;

  const meta = dramaFileMeta(absPath);
  const runDirAbs = path.resolve(ROOT, meta.runDir);
  const genMeta = readMetadata(runDirAbs);
  const genRow = genMeta && Array.isArray(genMeta.rows) ? genMeta.rows.find((r) => r.tid === meta.tid) : null;

  const dbRow = dbIndex ? dbIndex.byRunTid.get(`${meta.runBasename}::${meta.tid}`) : null;
  const itemId = dbRow ? dbRow.itemId : null;
  const scores = scoresOf(dbRow);

  const dramaId = (dbRow && dbRow.dramaId) || (genRow && genRow.drama_id) || null;
  const condition = (dbRow && dbRow.conditionName) || (genRow && genRow.condition) || null;
  const discipline = (dbRow && dbRow.discipline) || null;
  const date =
    (genMeta && (genMeta.generated_at || '').slice(0, 10)) || (dbRow && (dbRow.createdAt || '').slice(0, 10)) || '';

  return {
    itemId,
    runId: dbRow ? dbRow.runId : meta.runBasename,
    runDir: meta.runDir,
    tid: meta.tid,
    dramaId,
    title: humanize(dramaId || condition || meta.runBasename),
    discipline,
    condition,
    model: genMeta ? genMeta.model || null : null,
    date,
    stage: parsed.stage || null,
    excerpt: buildExcerpt(parsed, { turnsWanted: opts.excerptTurns }),
    turnCount: parsed.turns.length,
    scores,
    composite: Number(compositeOf(scores).toFixed(1)),
    // Item deep link (resolves to this exact drama) once the run is ingested into
    // the poetics DB; null until then. `browseUrl`/`openUrl` are always present so
    // the roundup never has a dead link — they fall back to the corpus browser.
    scriptoriumUrl: itemId ? `${opts.baseUrl}/browse?itemId=${encodeURIComponent(itemId)}` : null,
    localUrl: itemId ? `${opts.localUrl}/browse?itemId=${encodeURIComponent(itemId)}` : null,
    browseUrl: `${opts.baseUrl}/browse`,
    openUrl: itemId ? `${opts.baseUrl}/browse?itemId=${encodeURIComponent(itemId)}` : `${opts.baseUrl}/browse`,
    ingested: Boolean(itemId),
    sourcePath: meta.rel,
    capturedAt,
  };
}

// Keep durable prior snapshots whose source text may be gone; fresh re-derivations win.
function mergePools(existing, fresh) {
  const byKey = new Map();
  for (const e of existing) byKey.set(entryKey(e), e);
  for (const e of fresh) byKey.set(entryKey(e), e);
  return [...byKey.values()];
}

function rank(entries) {
  return entries.slice().sort((a, b) => {
    if (b.composite !== a.composite) return b.composite - a.composite;
    return String(b.date).localeCompare(String(a.date));
  });
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(2, 49).join('\n'));
    return;
  }
  const capturedAt = new Date().toISOString();

  // DB index (optional — degrades to disk-only when DB/CLI absent)
  let dbIndex = null;
  const dbPath = resolveDbPath(resolveEvaluationDbPath(ROOT, opts.db));
  if (haveSqlite3() && fs.existsSync(dbPath)) {
    try {
      dbIndex = loadDbIndex(dbPath);
      console.log(`[showcase] DB index: ${dbIndex.rows.length} scored items from ${dbPath}`);
    } catch (err) {
      console.warn(`[showcase] DB index unavailable (${err.message}); continuing disk-only`);
    }
  } else {
    console.warn('[showcase] sqlite3 CLI or DB not found; continuing disk-only (no scriptorium links/scores)');
  }

  // disk scan for drama text
  const files = [];
  for (const d of opts.fromDirs) walk(path.resolve(ROOT, d), files);
  console.log(`[showcase] scanned ${opts.fromDirs.join(', ')}: ${files.length} drama file(s) with text`);

  const fresh = [];
  const seen = new Set();
  for (const f of files) {
    try {
      const entry = buildEntry({ absPath: f, opts, dbIndex, capturedAt });
      if (!entry) continue;
      const k = entryKey(entry);
      if (seen.has(k)) continue;
      seen.add(k);
      fresh.push(entry);
    } catch (err) {
      console.warn(`[showcase] skip ${path.relative(ROOT, f)}: ${err.message}`);
    }
  }

  const outAbs = path.resolve(ROOT, opts.out);
  let existing = [];
  try {
    const prev = JSON.parse(fs.readFileSync(outAbs, 'utf8'));
    existing = Array.isArray(prev) ? prev : Array.isArray(prev.entries) ? prev.entries : [];
  } catch {
    existing = [];
  }

  const merged = rank(mergePools(existing, fresh)).slice(0, opts.limit);

  const ingested = merged.filter((e) => e.ingested).length;
  console.log(
    `[showcase] ${fresh.length} fresh + ${existing.length} prior -> ${merged.length} pooled ` +
      `(${ingested} with live scriptorium links)`,
  );

  if (opts.dryRun) {
    console.log(JSON.stringify(merged, null, 2));
    console.log('\n[showcase] --dry-run: nothing written');
    return;
  }

  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  console.log(`[showcase] wrote ${path.relative(ROOT, outAbs)} (${merged.length} entries)`);
  if (!ingested) {
    console.log(
      '[showcase] note: no entry has a scriptorium link yet — the on-disk runs are not in the\n' +
        '           poetics DB. Run `npm run poetics:ingest` on a run dir to make its dramas\n' +
        '           openable in the scriptorium, then re-run this to pick up the ids.',
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  try {
    main();
  } catch (err) {
    console.error(`[showcase] error: ${err.message}`);
    process.exit(1);
  }
}

export { parseTranscript, buildExcerpt, mergePools, dramaFileMeta };
