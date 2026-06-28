#!/usr/bin/env node
/**
 * refresh-blueprint.js — keep the "how to build the ideal AI tutor" blueprint
 * reference surface in sync with the paper it inherits from.
 *
 * The blueprint itself (notes/poetics/ideal-tutor-blueprint.html) is a QUALITATIVE
 * doc: its build steps are hand-authored (synthesised from the paper + codebase and
 * claim-audited against docs/research/paper-full-2.0.md before publishing). This
 * script does the MECHANICAL half of a refresh — the part a program can do
 * deterministically — so the page never silently drifts from the paper:
 *
 *   1. Re-stamps the provenance band (paper version + date, git commit, refresh
 *      date) between the BLUEPRINT:PROVENANCE markers.
 *   2. Validates that every `data-ref="…"` path the doc cites still exists, so a
 *      renamed prompt/rubric/engine is caught instead of rotting in the page.
 *   3. Reports staleness: whether the band's stamped paper version matches the
 *      current paper version (a cue that the steps/§ pointers may need re-synthesis).
 *
 * It deliberately does NOT rewrite the prose — the build steps cite specific §§ and
 * effect sizes that need reading and judgement (and a re-run of the claim audit).
 *
 * Usage:
 *   node scripts/refresh-blueprint.js            # re-stamp + validate, write
 *   node scripts/refresh-blueprint.js --check    # validate only, no write
 *   node scripts/refresh-blueprint.js --date 2026-06-25   # pin refresh date
 *   npm run blueprint:refresh                     # the re-stamp alias
 *   npm run blueprint:check                       # the CI / staleness alias
 *
 * Options:
 *   --doc <path>     blueprint HTML (default: notes/poetics/ideal-tutor-blueprint.html)
 *   --paper <path>   source paper (default: docs/research/paper-full-2.0.md)
 *   --date <ymd>     refresh date to stamp (default: today, UTC)
 *   --check          do not write; exit non-zero on missing refs or version drift
 *   --help, -h       show this message
 *
 * Exit codes: 0 ok · 1 a data-ref is missing, or (--check) the stamp is stale.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

const START = '<!-- BLUEPRINT:PROVENANCE:START -->';
const END = '<!-- BLUEPRINT:PROVENANCE:END -->';

function parseArgs(argv) {
  const out = {
    doc: 'notes/poetics/ideal-tutor-blueprint.html',
    paper: 'docs/research/paper-full-2.0.md',
    date: null,
    check: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--doc') out.doc = argv[++i];
    else if (a === '--paper') out.paper = argv[++i];
    else if (a === '--date') out.date = argv[++i];
    else if (a === '--check') out.check = true;
    else if (a === '--help' || a === '-h') {
      console.log(
        fs
          .readFileSync(__filename, 'utf8')
          .split('\n')
          .filter((l) => l.startsWith(' *') || l.startsWith('/**'))
          .join('\n'),
      );
      process.exit(0);
    } else throw new Error(`unknown argument: ${a}`);
  }
  return out;
}

// Pull `version:` and `date:` from the paper's YAML frontmatter.
function readPaperMeta(paperPath) {
  const text = fs.readFileSync(paperPath, 'utf8');
  const head = text.slice(0, 2000);
  const version = (head.match(/^version:\s*"?([^"\n]+)"?/m) || [])[1] || 'unknown';
  const date = (head.match(/^date:\s*"?([^"\n]+)"?/m) || [])[1] || 'unknown';
  return { version: version.trim(), date: date.trim() };
}

function gitShortSha() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

// The version currently stamped in the doc's provenance band (for staleness check).
function stampedVersion(html) {
  const band = html.slice(html.indexOf(START), html.indexOf(END));
  return (band.match(/v(\d+\.\d+\.\d+)/) || [])[1] || null;
}

function buildBand({ version, date, refreshed, sha }) {
  return (
    `${START}\n` +
    `    <div class="hero__rune"><span>§</span> Build blueprint · inherits <code>paper-full-2.0.md</code> ` +
    `v${version} (${date}) · refreshed ${refreshed} · commit ${sha}</div>\n` +
    `    ${END}`
  );
}

// Every data-ref the doc cites must resolve to a real file (or dir) under ROOT.
// Strip HTML comments first so prose that merely mentions data-ref (e.g. the doc's
// own header) is not mistaken for a real reference.
function validateRefs(html) {
  const body = html.replace(/<!--[\s\S]*?-->/g, '');
  const refs = [...body.matchAll(/data-ref="([^"]+)"/g)].map((m) => m[1]);
  const unique = [...new Set(refs)];
  const missing = unique.filter((ref) => !fs.existsSync(path.resolve(ROOT, ref)));
  return { total: unique.length, missing };
}

function run() {
  const args = parseArgs(process.argv.slice(2));
  const docPath = path.resolve(ROOT, args.doc);
  const paperPath = path.resolve(ROOT, args.paper);

  if (!fs.existsSync(docPath)) throw new Error(`blueprint doc not found: ${args.doc}`);
  if (!fs.existsSync(paperPath)) throw new Error(`paper not found: ${args.paper}`);

  const html = fs.readFileSync(docPath, 'utf8');
  if (!html.includes(START) || !html.includes(END)) {
    throw new Error(`provenance markers (${START} … ${END}) not found in ${args.doc}`);
  }

  const meta = readPaperMeta(paperPath);
  const sha = gitShortSha();
  const refreshed = args.date || todayUtc();
  const wasStamped = stampedVersion(html);

  // 1. validate referenced paths
  const { total, missing } = validateRefs(html);
  console.log(`blueprint · ${args.doc}`);
  console.log(`  paper        v${meta.version} (${meta.date})`);
  console.log(`  stamped      ${wasStamped ? 'v' + wasStamped : '(none)'}`);
  console.log(`  data-refs    ${total - missing.length}/${total} resolve`);
  if (missing.length) {
    console.log(`  ! missing references (the doc points at files that no longer exist):`);
    for (const m of missing) console.log(`      - ${m}`);
  }

  const stale = wasStamped !== meta.version;

  if (args.check) {
    if (missing.length) {
      console.log(`FAIL: ${missing.length} missing data-ref(s).`);
      process.exit(1);
    }
    if (stale) {
      console.log(
        `STALE: stamped v${wasStamped} ≠ paper v${meta.version} — re-read the paper, re-synthesise the build steps, and re-run the claim audit before \`npm run blueprint:refresh\`.`,
      );
      process.exit(1);
    }
    console.log('ok: refs resolve and provenance is current.');
    return;
  }

  // 2. re-stamp the band (write mode)
  const band = buildBand({ version: meta.version, date: meta.date, refreshed, sha });
  const next = html.replace(new RegExp(`${START}[\\s\\S]*?${END}`), band);
  if (next !== html) {
    fs.writeFileSync(docPath, next, 'utf8');
    console.log(`  -> re-stamped provenance band (refreshed ${refreshed}, commit ${sha})`);
  } else {
    console.log('  provenance band already current — no change');
  }

  if (missing.length) {
    console.log('FAIL: provenance stamped, but data-refs are missing (see above).');
    process.exit(1);
  }
  if (stale) {
    console.log(
      `NOTE: paper moved v${wasStamped || '?'} → v${meta.version}. The build steps inherit from the paper — re-read it, re-synthesise the steps, and re-run the claim audit so no number drifts.`,
    );
  }
}

try {
  run();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
