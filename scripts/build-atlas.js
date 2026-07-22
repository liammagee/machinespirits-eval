#!/usr/bin/env node
/**
 * build-atlas.js — project the canonical monolith (paper-full-2.0.md) into the
 * "research atlas" form proposed in notes/geist_dialogue_research_atlas_note.html:
 * a short SPINE plus a set of semi-autonomous MODULES ("arms"), each carrying a
 * claim-status label.
 *
 * PROJECTION, not split-source. paper-full-2.0.md stays the single source of
 * truth (and is still what provable-discourse machine-checks). This script never
 * edits it; it slices it by heading anchor and emits derived views. The
 * consolidated single PDF is unchanged — it IS the source, built via build.sh.
 *
 * Manifest: docs/research/atlas/atlas.yaml
 * Outputs:  docs/research/atlas/build/{modules/<id>.md,.pdf, spine.md,.pdf}
 *
 * Usage:
 *   node scripts/build-atlas.js validate [--strict]   # check manifest ⇄ paper
 *   node scripts/build-atlas.js build [--no-pdf]       # all modules + spine
 *   node scripts/build-atlas.js module <id> [--no-pdf] # one arm (no spine)
 *   node scripts/build-atlas.js consolidated           # the single PDF (build.sh paper2)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import YAML from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const RESEARCH_DIR = path.join(ROOT, 'docs/research');
const PAPER = path.join(RESEARCH_DIR, 'paper-full-2.0.md');
const MANIFEST = path.join(RESEARCH_DIR, 'atlas/atlas.yaml');
const BUILD_DIR = path.join(RESEARCH_DIR, 'atlas/build');
const MODULES_DIR = path.join(BUILD_DIR, 'modules');

// Claim-status grammar (note §"The dossier needs explicit claim-status labels").
const STATUS = {
  settled: { tag: 'SUPPORTED', label: 'Supported by the current evidence' },
  'scope-bound': { tag: 'SCOPE-BOUND', label: 'Supported within a narrow scope' },
  exploratory: { tag: 'EXPLORING', label: 'Promising, but still exploratory' },
  killed: { tag: 'CLOSED', label: 'Tested and closed under its stated gate' },
  speculative: { tag: 'PROPOSITION', label: 'A theoretical proposal, not a result' },
  methods: { tag: 'METHOD', label: 'A contribution to how the research is done' },
  planned: { tag: 'PLANNED', label: 'Planned work; evidence still to come' },
  future: { tag: 'NEXT', label: 'A future empirical question' },
};

// ---- parsing helpers -------------------------------------------------------

function loadManifest() {
  if (!fs.existsSync(MANIFEST)) fail(`manifest not found: ${rel(MANIFEST)}`);
  const m = YAML.parse(fs.readFileSync(MANIFEST, 'utf8')) || {};
  if (!Array.isArray(m.modules)) fail('manifest has no `modules:` array');
  return m;
}

function loadPaper() {
  if (!fs.existsSync(PAPER)) fail(`paper not found: ${rel(PAPER)}`);
  const raw = fs.readFileSync(PAPER, 'utf8');
  const lines = raw.split('\n');
  let meta = {};
  if (lines[0]?.trim() === '---') {
    let end = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        end = i;
        break;
      }
    }
    if (end > 0) {
      try {
        meta = YAML.parse(lines.slice(1, end).join('\n')) || {};
      } catch {
        /* tolerate */
      }
    }
  }
  return {
    lines,
    version: meta.version || 'dev',
    author: meta.author || '',
    date: meta.date || '',
    headings: parseHeadings(lines),
  };
}

function parseHeadings(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+(.*?)\s*$/);
    if (!m) continue;
    const text = m[2].trim();
    const numMatch = text.match(/^(\d+(?:\.\d+)*)\.?(?=\s|$)/);
    out.push({ i, level: m[1].length, text, num: numMatch ? numMatch[1] : null });
  }
  return out;
}

// An anchor matches a heading by its section number ("6.3"), exact text, or
// case-insensitive text. Numbered matching is exact on the token, so "6.3"
// matches `### 6.3 …` but NOT `#### 6.3.2 …`.
function findHeadings(headings, anchor) {
  const a = String(anchor).trim();
  const al = a.toLowerCase();
  return headings.filter((h) => (h.num && h.num === a) || h.text === a || h.text.toLowerCase() === al);
}

// Slice from a heading down to (excluding) the next heading at the same or
// higher level. NOTE: appendix prompt bodies embed rogue level-1 `#` headings,
// so modules should reference body sections (§1–9), not appendices.
function sliceSection(lines, headings, h) {
  let end = lines.length;
  for (const hh of headings) {
    if (hh.i > h.i && hh.level <= h.level) {
      end = hh.i;
      break;
    }
  }
  return lines.slice(h.i, end);
}

// ---- rendering -------------------------------------------------------------

const yq = (s) => JSON.stringify(String(s ?? '')); // safe YAML double-quoted scalar
const familyLabel = (man, fam) => (man.families && man.families[fam]) || fam;
const cell = (s) =>
  String(s ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\s*\n\s*/g, ' ');
const byN = (man) => [...man.modules].sort((a, b) => (a.n ?? 0) - (b.n ?? 0));

function frontmatter(title, subtitle, paper) {
  return [
    '---',
    `title: ${yq(title)}`,
    `subtitle: ${yq(subtitle)}`,
    `author: ${yq(paper.author)}`,
    `date: ${yq(paper.date)}`,
    'bibliography: references.bib',
    'csl: apa.csl',
    'link-citations: true',
    'fontsize: 12pt',
    'geometry: margin=1in',
    'header-includes: |',
    '  \\usepackage{float}',
    '  \\floatplacement{figure}{H}',
    '---',
    '',
  ].join('\n');
}

function buildModule(m, man, paper) {
  const st = STATUS[m.status] || { tag: m.status, label: m.status };
  const fam = familyLabel(man, m.family);
  const anchors = m.sections && m.sections.length ? m.sections.map((s) => `§${s}`).join(', ') : '(none yet)';
  const out = [];
  out.push(frontmatter(m.title, `Geist Atlas · Module ${m.n} · ${fam}`, paper));
  out.push(`# ${m.title}\n`);
  out.push(`> **[${st.tag}]** ${st.label}  ·  **Family:** ${fam}  `);
  if (m.claim) out.push(`> **Claim:** ${m.claim}  `);
  out.push('>');
  if (m.abstract) out.push(`> ${m.abstract.trim()}`);
  out.push('>');
  out.push(
    `> *Derived view of \`paper-full-2.0.md\` v${paper.version} — ${anchors}. The paper is canonical; edit it there, not here.*\n`,
  );

  if (!m.sections || m.sections.length === 0) {
    out.push(
      '_This module is scaffolded. Its arc is an active workstream; prose will be ' +
        'projected here once the corresponding section lands in the canonical paper._\n',
    );
  } else {
    for (const anchor of m.sections) {
      const h = findHeadings(paper.headings, anchor)[0];
      out.push(sliceSection(paper.lines, paper.headings, h).join('\n'));
      out.push('');
    }
  }

  if (m.cross_refs && m.cross_refs.length) {
    const refs = m.cross_refs.map((id) => {
      const r = man.modules.find((x) => x.id === id);
      return r ? `Module ${r.n} — ${r.title}` : id;
    });
    out.push('\n---\n');
    out.push(`**Neighbouring modules:** ${refs.join('; ')}.`);
  }
  return out.join('\n');
}

function buildSpine(man, paper) {
  const a = man.atlas || {};
  const out = [];
  out.push(frontmatter(`${a.title || 'Research Atlas'} — Volume Spine`, a.subtitle || '', paper));
  out.push(`# ${a.title || 'Research Atlas'}\n`);
  if (a.subtitle) out.push(`### ${a.subtitle}\n`);
  out.push(
    `> Spine generated from \`paper-full-2.0.md\` v${paper.version}. The statuses and ` +
      `the evidence map below come from \`atlas.yaml\` and stay in sync automatically.\n`,
  );
  if (a.orientation) out.push('## Orientation\n', `${a.orientation.trim()}\n`);
  if (a.core_idea) out.push('## The core idea\n', `${a.core_idea.trim()}\n`);

  if (Array.isArray(a.findings) && a.findings.length) {
    out.push('## The findings\n');
    if (a.families_intro) out.push(`${a.families_intro.trim()}\n`);
    for (const f of a.findings) {
      const st = STATUS[f.verdict] || { tag: f.verdict, label: f.verdict };
      out.push(`### ${f.family}\n`);
      out.push(`**[${st.tag}]** ${st.label}\n`);
      if (f.body) out.push(`${f.body.trim()}\n`);
      if (f.caveat) out.push(`*Caveat.* ${f.caveat.trim()}\n`);
    }
  }

  if (a.maps?.methodological) out.push('## How we checked the work\n', `${a.maps.methodological.trim()}\n`);

  out.push('## Evidence map\n');
  if (a.maps?.evidence) out.push(`${a.maps.evidence.trim()}\n`);
  // Scannable index only — #/Module/Family/Status. The full claim sentence is
  // not a table column (it wraps badly in a narrow cell and balloons the table
  // across pages); each module's claim is carried as prose in "The modules" below.
  out.push('| # | Module | Family | Status |');
  out.push('|---|--------|--------|--------|');
  for (const m of byN(man)) {
    const st = STATUS[m.status] || { tag: m.status };
    out.push(`| ${m.n} | ${cell(m.title)} | ${cell(familyLabel(man, m.family))} | ${st.tag} |`);
  }
  out.push('');

  out.push('## The modules\n');
  for (const m of byN(man)) {
    const st = STATUS[m.status] || { tag: m.status, label: m.status };
    out.push(`### Module ${m.n} — ${m.title}\n`);
    out.push(`**[${st.tag}]** ${st.label}  ·  *${familyLabel(man, m.family)}*\n`);
    if (m.abstract) out.push(`${m.abstract.trim()}\n`);
    const anchors =
      m.sections && m.sections.length ? m.sections.map((s) => `§${s}`).join(', ') : '— (scaffold; prose pending)';
    out.push(`*Sources:* ${anchors}\n`);
  }

  out.push('## How to read the status labels\n');
  for (const k of Object.keys(STATUS)) out.push(`- **[${STATUS[k].tag}]** — ${STATUS[k].label}`);
  out.push('');

  if (a.glossary && typeof a.glossary === 'object') {
    out.push('## A short glossary\n');
    for (const [term, def] of Object.entries(a.glossary)) out.push(`**${term}.** ${String(def).trim()}\n`);
  }

  if (a.whats_open) out.push("## What's still open\n", `${a.whats_open.trim()}\n`);

  return out.join('\n');
}

// ---- validation ------------------------------------------------------------

function validate(man, paper) {
  const errors = [];
  const warnings = [];
  const ids = new Set();

  for (const m of man.modules) {
    const who = `module #${m.n ?? '?'} (${m.id ?? '?'})`;
    for (const f of ['id', 'n', 'title', 'family', 'status']) {
      if (m[f] === undefined || m[f] === null || m[f] === '') errors.push(`${who}: missing required field '${f}'`);
    }
    if (m.id) {
      if (ids.has(m.id)) errors.push(`duplicate module id '${m.id}'`);
      ids.add(m.id);
    }
    if (m.status && !STATUS[m.status])
      errors.push(`${who}: unknown status '${m.status}' (allowed: ${Object.keys(STATUS).join(', ')})`);
    if (m.family && man.families && !man.families[m.family])
      warnings.push(`${who}: family '${m.family}' has no label under families:`);
    for (const anchor of m.sections || []) {
      const hits = findHeadings(paper.headings, anchor);
      if (hits.length === 0) errors.push(`${who}: section anchor '${anchor}' resolves to NO heading in the paper`);
      else if (hits.length > 1)
        errors.push(
          `${who}: section anchor '${anchor}' is AMBIGUOUS (${hits.length} matches: ${hits
            .map((h) => `"${h.text}"`)
            .join(', ')})`,
        );
    }
  }

  for (const m of man.modules)
    for (const r of m.cross_refs || [])
      if (!ids.has(r)) warnings.push(`module '${m.id}': cross_ref '${r}' is not a known module id`);

  // Coverage of numbered body sections (§1–9).
  const exclude = new Set((man.atlas?.exclude || []).map(String));
  const covered = new Set();
  for (const m of man.modules) for (const anchor of m.sections || []) covered.add(String(anchor).split('.')[0]);
  for (const h of paper.headings) {
    if (h.level === 2 && h.num && /^[1-9]$/.test(h.num) && !covered.has(h.num) && !exclude.has(h.num))
      warnings.push(`paper §${h.num} "${h.text}" is in no module and not in atlas.exclude`);
  }

  const byStatus = {};
  for (const m of man.modules) byStatus[m.status] = (byStatus[m.status] || 0) + 1;
  const info = [
    `modules: ${man.modules.length}`,
    `by status: ${Object.entries(byStatus)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ')}`,
    `covered §§: ${[...covered].sort().join(', ')}  ·  excluded: ${[...exclude].sort().join(', ') || '(none)'}`,
  ];
  return { errors, warnings, info };
}

function report(v) {
  for (const i of v.info) console.log(`  info  ${i}`);
  for (const w of v.warnings) console.log(`  warn  ${w}`);
  for (const e of v.errors) console.log(`  ERROR ${e}`);
  console.log(`\n  ${v.errors.length} error(s), ${v.warnings.length} warning(s).`);
}

// ---- pdf -------------------------------------------------------------------

function pandocAvailable() {
  try {
    execFileSync('pandoc', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function renderPdf(relMd, relPdf) {
  execFileSync('pandoc', ['--citeproc', '--pdf-engine=xelatex', '-H', 'header.tex', relMd, '-o', relPdf], {
    cwd: RESEARCH_DIR,
    stdio: 'inherit',
  });
}

// ---- commands --------------------------------------------------------------

function cmdBuild({ pdf, onlyModule }) {
  const man = loadManifest();
  const paper = loadPaper();
  const v = validate(man, paper);
  report(v);
  if (v.errors.length) fail('validation failed — fix the manifest before building');

  const targets = onlyModule ? man.modules.filter((m) => m.id === onlyModule) : man.modules;
  if (onlyModule && targets.length === 0) fail(`no module with id '${onlyModule}'`);

  fs.mkdirSync(MODULES_DIR, { recursive: true });
  const canPdf = pdf && pandocAvailable();
  if (pdf && !canPdf) console.log('  note  pandoc not found — emitting markdown only.');

  console.log(`\nBuilding atlas from paper-full-2.0.md v${paper.version}:`);
  for (const m of byN(man).filter((m) => targets.includes(m))) {
    const mdPath = path.join(MODULES_DIR, `${m.id}.md`);
    fs.writeFileSync(mdPath, buildModule(m, man, paper));
    console.log(`  module ${m.n}  → ${rel(mdPath)}`);
    if (canPdf) {
      try {
        renderPdf(`atlas/build/modules/${m.id}.md`, `atlas/build/modules/${m.id}.pdf`);
      } catch (e) {
        console.log(`  warn  pdf failed for '${m.id}': ${e.message.split('\n')[0]}`);
      }
    }
  }

  if (!onlyModule) {
    const spinePath = path.join(BUILD_DIR, 'spine.md');
    fs.writeFileSync(spinePath, buildSpine(man, paper));
    console.log(`  spine     → ${rel(spinePath)}`);
    if (canPdf) {
      try {
        renderPdf('atlas/build/spine.md', 'atlas/build/spine.pdf');
      } catch (e) {
        console.log(`  warn  pdf failed for spine: ${e.message.split('\n')[0]}`);
      }
    }
  }
  console.log('\nDone.');
}

function cmdValidate({ strict }) {
  const man = loadManifest();
  const paper = loadPaper();
  const v = validate(man, paper);
  report(v);
  if (v.errors.length) process.exit(1);
  if (strict && v.warnings.length) process.exit(1);
}

function cmdConsolidated() {
  console.log('Building the consolidated single PDF (build.sh paper2)…');
  execFileSync('bash', ['build.sh', 'paper2'], { cwd: RESEARCH_DIR, stdio: 'inherit' });
}

// ---- util / main -----------------------------------------------------------

function rel(p) {
  return path.relative(ROOT, p);
}
function fail(msg) {
  console.error(`build-atlas: ${msg}`);
  process.exit(1);
}

function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const pdf = !argv.includes('--no-pdf');
  const strict = argv.includes('--strict');
  const mi = argv.indexOf('--module');
  let onlyModule = mi >= 0 ? argv[mi + 1] : null;
  if (cmd === 'module' && argv[1] && !argv[1].startsWith('--')) onlyModule = argv[1];

  switch (cmd) {
    case 'validate':
      return cmdValidate({ strict });
    case 'build':
      return cmdBuild({ pdf, onlyModule });
    case 'module':
      if (!onlyModule) fail('usage: build-atlas module <id> [--no-pdf]');
      return cmdBuild({ pdf, onlyModule });
    case 'consolidated':
      return cmdConsolidated();
    default:
      console.log(
        [
          'build-atlas — project paper-full-2.0.md into the research-atlas form.',
          '',
          'Commands:',
          '  validate [--strict]      check the manifest resolves against the paper',
          '  build [--no-pdf]         build all modules + the spine',
          '  module <id> [--no-pdf]   build one module (no spine)',
          '  consolidated             build the single PDF (build.sh paper2)',
        ].join('\n'),
      );
      if (cmd) process.exit(1);
  }
}

main();
