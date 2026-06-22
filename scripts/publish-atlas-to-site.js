#!/usr/bin/env node
/* publish-atlas-to-site.js — stage the research atlas (a techne HUB page + the
   module PDFs + the consolidated paper PDF) for machinespirits.org.

   Sibling of notes/poetics/publish-arc-to-site.js, same cross-repo seam:
   the content-philosophy repo's ./publish triggers the website's Fly redeploy.
   The hub serves at the static content path
   /content/articles/ai-tutor/geist-atlas.html (same family as geist-explained
   and the dramatic-recognition arc), NOT an /essays/ route.

   What it does:
     1. PROJECT the hub from docs/research/atlas/atlas.yaml — title, maps,
        evidence grid (one card per module, linking to its PDF), status grammar.
        Same manifest the PDFs are built from, so the page can't drift.
     2. SELF-CONTAIN it — techne.css + techne.js are inlined at generation time
        (fonts stay on the Google CDN), so the page needs no sibling assets/ on
        the site and can be written straight into the content repo.
     3. COPY the built PDFs: docs/research/atlas/build/{spine.pdf,modules/<id>.pdf}
        → articles/ai-tutor/atlas/, and the consolidated paper PDF
        docs/research/paper-2.0-v<version>.pdf → articles/ai-tutor/.
     4. write a BACKDATED frontmatter stub geist-atlas.md so content-philosophy's
        ./build never Pandoc-clobbers the hand-generated .html (same 1-second
        -nt trick as the arc publisher).
     5. print the ./publish command — the actual outward deploy is human-gated
        (only --publish runs it).

   The module/spine PDFs must already be built (npm run atlas:build). This script
   is the light publish step; it does NOT shell out to xelatex.

   Usage:
     node scripts/publish-atlas-to-site.js              # stage (no deploy)
     node scripts/publish-atlas-to-site.js --dry-run    # print plan, write nothing
     node scripts/publish-atlas-to-site.js --publish    # stage + ./publish (DEPLOYS LIVE)
     node scripts/publish-atlas-to-site.js --slug NAME  # output basename (default geist-atlas)
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import YAML from 'yaml';

const HERE = path.dirname(fileURLToPath(import.meta.url)); // scripts/
const REPO = path.resolve(HERE, '..'); // machinespirits-eval-dramatic
const RESEARCH_DIR = path.join(REPO, 'docs/research');
const PAPER = path.join(RESEARCH_DIR, 'paper-full-2.0.md');
const MANIFEST = path.join(RESEARCH_DIR, 'atlas/atlas.yaml');
const BUILD_DIR = path.join(RESEARCH_DIR, 'atlas/build');
const MODULES_DIR = path.join(BUILD_DIR, 'modules');
const ASSETS_DIR = path.join(REPO, 'notes/poetics/assets'); // techne.css / techne.js
const DEST_REPO = path.resolve(REPO, '../machinespirits-content-philosophy');
const DEST_DIR = path.join(DEST_REPO, 'articles', 'ai-tutor');
const DEST_ATLAS = path.join(DEST_DIR, 'atlas');

// Claim-status grammar — canonical copy in scripts/build-atlas.js. Each status maps
// to a techne ev-card visual bucket (data-status → left-border colour) and a chip tint.
const STATUS = {
  settled: { tag: 'SETTLED', label: 'Settled within current evidence', ev: 'strong', chip: 'moss' },
  'scope-bound': { tag: 'SCOPE-BOUND', label: 'Supported but scope-bound', ev: 'boundary', chip: 'ochre' },
  exploratory: { tag: 'EXPLORATORY', label: 'Exploratory', ev: 'boundary', chip: 'ochre' },
  killed: { tag: 'KILLED', label: 'Killed / closed under a specified gate', ev: 'risk', chip: 'brick' },
  speculative: { tag: 'SPECULATIVE', label: 'Speculative / theoretical', ev: 'boundary', chip: 'ochre' },
  methods: { tag: 'METHODS', label: 'Methods / apparatus contribution', ev: 'output', chip: 'ink' },
  planned: { tag: 'PLANNED', label: 'Planned — scaffold, prose pending', ev: 'output', chip: 'ink' },
  future: { tag: 'FUTURE', label: 'Future empirical agenda', ev: 'output', chip: 'ink' },
};

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};
const DRY = has('--dry-run');
const DO_PUBLISH = has('--publish');
const SLUG = val('--slug', 'geist-atlas');
const DATE = '2026-06-03';

const familyLabel = (man, fam) => (man.families && man.families[fam]) || fam;
const byN = (man) => [...man.modules].sort((a, b) => (a.n ?? 0) - (b.n ?? 0));

// ---- minimal markdown-inline → HTML for the manifest's prose blocks ----------
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function mdInline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}
// A YAML literal block → array of <p>…</p> (blank-line-separated paragraphs).
function paras(text) {
  return String(text || '')
    .trim()
    .split(/\n\s*\n/)
    .map((p) => `<p>${mdInline(p.replace(/\s*\n\s*/g, ' ').trim())}</p>`);
}
function sourcesOf(m) {
  return m.sections && m.sections.length ? m.sections.map((s) => `§${s}`).join(', ') : 'scaffold; prose pending';
}

// ---- mini-visuals: chip colour → CSS custom property -------------------------
// Inline-styled panels (family grid, status strip) read these tokens so they
// inherit the techne palette AND flip with the dark-mode theme for free — no
// atlas-only classes added to the shared stylesheet.
const CHIP_VAR = { moss: 'var(--moss)', ochre: 'var(--ochre)', brick: 'var(--brick)', ink: 'var(--ink-3)' };

// The three findings families as numbered claim/caveat pairs (techne .claim).
// The caveat text is bare — .claim__counter::before auto-labels it "caveat.".
function renderFindings(findings) {
  if (!Array.isArray(findings)) return '';
  return findings
    .map((f, i) => {
      const st = STATUS[f.verdict] || { tag: f.verdict, chip: 'ink' };
      const body = paras(f.body).join('\n              ');
      const caveat = f.caveat ? `\n            <div class="claim__counter">${mdInline(f.caveat)}</div>` : '';
      return `<div class="claim">
            <div class="claim__no">${String(i + 1).padStart(2, '0')}</div>
            <h3 class="claim__h">${mdInline(f.family)}</h3>
            <div class="claim__body">
              <p style="margin:0 0 .6em;"><span class="chip chip--${st.chip}"><span class="chip__dot"></span> ${st.tag}</span></p>
              ${body}
            </div>${caveat}
          </div>`;
    })
    .join('\n          ');
}

// A scannable grid of the findings families, each a status-coloured top-border
// card — the visual entry point above the prose claims.
function renderFamilyPanel(findings) {
  if (!Array.isArray(findings)) return '';
  const cell = (f) => {
    const st = STATUS[f.verdict] || { tag: f.verdict, chip: 'ink' };
    return `<div style="border:1px solid var(--rule);border-top:3px solid ${
      CHIP_VAR[st.chip] || 'var(--ink-3)'
    };background:var(--paper-3);padding:1em 1.1em;">
                <span class="chip chip--${st.chip}" style="margin:0 0 .6em;"><span class="chip__dot"></span> ${st.tag}</span>
                <h4 style="font-family:'Fraunces',Georgia,serif;font-size:var(--s-2);font-weight:500;color:var(--ink);margin:.5em 0 0;line-height:1.15;">${mdInline(
                  f.family,
                )}</h4>
              </div>`;
  };
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(14rem,100%),1fr));gap:.8em;margin:1.6em 0 .3em;">
              ${findings.map(cell).join('\n              ')}
            </div>`;
}

// A horizontal bar-per-status tally of the modules — the evidence map at a glance.
function renderStatusStrip(mods) {
  const counts = {};
  for (const m of mods) counts[m.status] = (counts[m.status] || 0) + 1;
  const order = Object.keys(STATUS).filter((k) => counts[k]);
  if (!order.length) return '';
  const max = Math.max(...order.map((k) => counts[k]));
  const rows = order
    .map((k) => {
      const pct = Math.max(8, Math.round((counts[k] / max) * 100));
      return `<div style="display:grid;grid-template-columns:9rem 1fr 1.4rem;gap:.6em;align-items:center;">
                <span class="chip chip--${STATUS[k].chip}" style="margin:0;"><span class="chip__dot"></span> ${
                  STATUS[k].tag
                }</span>
                <span style="display:block;height:.55rem;background:var(--rule-soft);"><span style="display:block;height:100%;width:${pct}%;background:${
                  CHIP_VAR[STATUS[k].chip] || 'var(--ink-3)'
                };"></span></span>
                <span class="label" style="text-align:right;">${counts[k]}</span>
              </div>`;
    })
    .join('\n              ');
  return `<div style="display:grid;gap:.5em;margin:1em 0 .3em;">
              ${rows}
            </div>`;
}

// The plain-language glossary as a techne definition list. #glossaryList is the
// conventional hook techne.js reads for inline .gl-term tooltips; harmless here
// (the hub's prose carries no inline terms) and correct if any are added later.
function renderGlossary(glossary) {
  if (!glossary || typeof glossary !== 'object') return '';
  const rows = Object.entries(glossary)
    .map(([term, def]) => `<div class="gl-row"><dt>${mdInline(term)}</dt><dd>${mdInline(def)}</dd></div>`)
    .join('\n              ');
  return `<dl class="glossary" id="glossaryList">
              ${rows}
            </dl>`;
}

// ---- read paper version from its frontmatter --------------------------------
function paperVersion() {
  const raw = fs.readFileSync(PAPER, 'utf8');
  const m = raw.match(/^version:\s*"?([^"\n]+)"?/m);
  return m ? m[1].trim() : 'dev';
}

// ---- generate the self-contained techne hub ---------------------------------
function genHub(man, version, pdfPresent, paperPdfName) {
  const a = man.atlas || {};
  const css = fs.readFileSync(path.join(ASSETS_DIR, 'techne.css'), 'utf8');
  // Escape `</script` in the inlined JS: the HTML parser ends a <script> at the FIRST
  // literal `</script` it sees — even inside a JS comment or string. techne.js documents
  // its own usage with `…techne.js"></script>` in its header comment, so inlined verbatim
  // it self-terminates and dumps the rest of the file as visible page text. `<\/script`
  // is byte-identical in every JS context (`\/` === `/`, harmless in a comment) but the
  // close-tag scanner no longer matches it.
  const js = fs.readFileSync(path.join(ASSETS_DIR, 'techne.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
  const mods = byN(man);
  const present = [...new Set(mods.map((m) => m.status))].filter((s) => STATUS[s]);

  const orient = paras(a.orientation);
  const lede = orient.slice(0, 1).join('\n          ');
  const orientRest = orient.slice(1).join('\n          ') || '';

  const filterBtns = [
    '<button class="filter-btn" data-filter="all" aria-pressed="true" type="button">All</button>',
    ...present.map(
      (s) =>
        `<button class="filter-btn" data-filter="${s}" aria-pressed="false" type="button">${STATUS[s].tag}</button>`,
    ),
  ].join('\n              ');

  const cards = mods
    .map((m) => {
      const st = STATUS[m.status] || { tag: m.status, ev: 'output', chip: 'ink' };
      const fam = familyLabel(man, m.family);
      const link = pdfPresent.has(m.id)
        ? `<div class="deeplink-row">
                  <a class="deeplink" href="atlas/${m.id}.pdf" target="_blank" rel="noopener">
                    <span>Read module ${m.n} (PDF)</span><span class="deeplink__arrow">↗</span>
                  </a>
                </div>`
        : `<p><em>PDF pending — build with <code>npm run atlas:build</code>.</em></p>`;
      return `<article class="ev-card" data-status="${st.ev}" data-tags="${m.status}">
                <span class="chip chip--${st.chip}"><span class="chip__dot"></span> ${st.tag}</span>
                <h3>${m.n}. ${esc(m.title)}</h3>
                <p>${mdInline(m.claim || m.abstract || '')}</p>
                <p><strong>${esc(fam)}</strong> · Sources: ${esc(sourcesOf(m))}</p>
                ${link}
              </article>`;
    })
    .join('\n\n              ');

  const grammar = Object.keys(STATUS)
    .filter((k) => present.includes(k))
    .map(
      (k) =>
        `<li><span class="chip chip--${STATUS[k].chip}"><span class="chip__dot"></span> ${STATUS[k].tag}</span> ${esc(
          STATUS[k].label,
        )}</li>`,
    )
    .join('\n            ');

  // New patient-explainer prose blocks + hand-authored mini-visuals.
  const coreIdea = paras(a.core_idea).join('\n          ');
  const familiesIntro = paras(a.families_intro).join('\n          ');
  const methodological = paras(a.maps?.methodological).join('\n          ');
  const evidenceLede = paras(a.maps?.evidence).join('\n          ');
  const whatsOpen = paras(a.whats_open).join('\n          ');
  const findingsHtml = renderFindings(a.findings);
  const familyPanelHtml = renderFamilyPanel(a.findings);
  const statusStripHtml = renderStatusStrip(mods);
  const glossaryHtml = renderGlossary(a.glossary);

  const fontHref =
    'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Source+Serif+4:opsz,wght@8..60,200..900&family=JetBrains+Mono:wght@300..700&display=swap';

  return `<!doctype html>
<!-- GENERATED by scripts/publish-atlas-to-site.js from docs/research/atlas/atlas.yaml.
     Do not edit by hand — edit the manifest (and the paper) and re-run the publisher.
     A projection of paper-full-2.0.md v${version}; the paper stays canonical. -->
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="color-scheme" content="light dark" />
<title>${esc(a.title || 'Research Atlas')} — Research Atlas</title>
<meta name="description" content="${esc(a.subtitle || '')} A projection of paper-full-2.0.md into a spine plus semi-autonomous modules." />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="${fontHref}" />
<style>
${css}
</style>
</head>

<body>

<header class="rail" id="rail">
  <div class="rail__inner">
    <span class="rail__title">Geist Atlas</span>
    <span class="rail__dot" aria-hidden="true"></span>
    <nav class="rail__nav" aria-label="Section navigation">
      <a href="#orientation">What it is</a>
      <a href="#core-idea">Core idea</a>
      <a href="#findings">Findings</a>
      <a href="#method">Method</a>
      <a href="#modules">Modules</a>
      <a href="#grammar">Status</a>
      <a href="#glossary">Glossary</a>
      <a href="#open">Open</a>
    </nav>
    <div class="rail__actions">
      <button class="rail__btn" id="themeToggle" type="button">Dark</button>
    </div>
  </div>
  <div class="rail__progress" id="railProgress"></div>
</header>

<main>

  <section class="hero">
    <div class="hero__rune">
      <span>§</span> Research atlas · projected from <code>paper-full-2.0.md</code> v${version}
    </div>

    <div class="hero__masthead">
      <span class="label">${esc(a.title || 'Research Atlas')}</span>
      <span class="hero__rule"></span>
      <span class="label">Volume Spine</span>
    </div>

    <h1 class="hero__h1">A Research Atlas of <span class="em">Dialectical Agent Pedagogy</span></h1>

    <p class="hero__subtitle">
      What makes an AI tutor teach well — the model it runs on, or the inner structure it reasons
      with? A plain-language tour of the programme, then ${mods.length} modules you can open on their own.
    </p>

    <div class="hero__lede">
      <div>
          ${lede}
      </div>
    </div>

    <div class="deeplink-row">
      <a class="deeplink" href="${paperPdfName}" target="_blank" rel="noopener">
        <span>Consolidated paper · v${version} (PDF)</span><span class="deeplink__arrow">↗</span>
      </a>
      <a class="deeplink" href="atlas/spine.pdf" target="_blank" rel="noopener">
        <span>Volume spine (PDF)</span><span class="deeplink__arrow">↗</span>
      </a>
    </div>
  </section>

  <div class="shell">

    <section class="s" id="orientation">
      <div class="diag">
        <div class="ml"><h2 class="s__num">01<span class="glyph">·</span></h2></div>
        <div class="body">
          <p class="s__kicker">What this is</p>
          <h2 class="s__h">A programme, and a map of it.</h2>
          ${orientRest}
        </div>
        <div class="mr">
          <p class="note note--moss"><span class="note__lbl">Note</span> Everything here is generated from
            one source paper, so this page cannot quietly drift from the evidence. Read this page for the
            whole story; open a module for the detail.</p>
        </div>
      </div>
    </section>

    <section class="s" id="core-idea">
      <div class="diag">
        <div class="ml"><h2 class="s__num">02<span class="glyph">·</span></h2></div>
        <div class="body">
          <p class="s__kicker">The core idea</p>
          <h2 class="s__h">Two ideas, borrowed from philosophy.</h2>
          ${coreIdea}
        </div>
      </div>
    </section>

    <section class="s" id="findings">
      <div class="diag">
        <div class="ml"><h2 class="s__num">03<span class="glyph">·</span></h2></div>
        <div class="body">
          <p class="s__kicker">The findings</p>
          <h2 class="s__h">Three families of answer.</h2>
          ${familiesIntro}
          ${familyPanelHtml}
          ${findingsHtml}
        </div>
        <div class="mr">
          <p class="note note--ochre"><span class="note__lbl">Note</span> Each family carries a one-word
            claim-status — how firm the result is. The full grammar is two sections down.</p>
        </div>
      </div>
    </section>

    <section class="s" id="method">
      <div class="diag">
        <div class="ml"><h2 class="s__num">04<span class="glyph">·</span></h2></div>
        <div class="body">
          <p class="s__kicker">How we know it</p>
          <h2 class="s__h">The apparatus is part of the result.</h2>
          ${methodological}
        </div>
      </div>
    </section>

    <section class="s" id="modules">
      <div class="diag">
        <div class="ml"><h2 class="s__num">05<span class="glyph">·</span></h2></div>
        <div class="body">
          <p class="s__kicker">Read deeper</p>
          <h2 class="s__h">The modules, by family and status.</h2>
          ${evidenceLede}
          ${statusStripHtml}

          <div class="filters" role="toolbar" aria-label="Module filters">
              ${filterBtns}
          </div>

          <div class="ev-grid" id="evidenceGrid">
              ${cards}
          </div>
        </div>
        <div class="mr">
          <p class="note note--ochre"><span class="note__lbl">Note</span> Filter the grid by status. The
            grid is generated from <code>atlas.yaml</code>, so a status change propagates here automatically.</p>
        </div>
      </div>
    </section>

    <section class="s" id="grammar">
      <div class="diag">
        <div class="ml"><h2 class="s__num">06<span class="glyph">·</span></h2></div>
        <div class="body">
          <p class="s__kicker">Claim-status</p>
          <h2 class="s__h">What each label commits to.</h2>
          <ul class="grammar">
            ${grammar}
          </ul>
        </div>
      </div>
    </section>

    <section class="s" id="glossary">
      <div class="diag">
        <div class="ml"><h2 class="s__num">07<span class="glyph">·</span></h2></div>
        <div class="body">
          <p class="s__kicker">In plain words</p>
          <h2 class="s__h">A short glossary.</h2>
          ${glossaryHtml}
        </div>
      </div>
    </section>

    <section class="s" id="open">
      <div class="diag">
        <div class="ml"><h2 class="s__num">08<span class="glyph">·</span></h2></div>
        <div class="body">
          <p class="s__kicker">Limits</p>
          <h2 class="s__h">What's still open.</h2>
          ${whatsOpen}
        </div>
        <div class="mr">
          <p class="note note--ink"><span class="note__lbl">Note</span> None of this is a deployment claim
            or a claim about human learning — it is a set of scoped findings about agent architecture, with
            the boundaries marked.</p>
        </div>
      </div>
    </section>

  </div><!-- /shell -->

  <footer class="colophon">
    <p><span class="label">Colophon</span> &nbsp; Projected from <code>paper-full-2.0.md</code> v${version}
      via <code>scripts/build-atlas.js</code> + <code>scripts/publish-atlas-to-site.js</code>.
      Typeset in Fraunces, Source Serif 4, JetBrains Mono.</p>
  </footer>

</main>

<script>
${js}
</script>
</body>
</html>
`;
}

// ---- frontmatter stub (index metadata only; backdated below) ----------------
const frontmatterStub = `---
title: "Geist in the Machine — A Research Atlas of Dialectical Agent Pedagogy"
date: ${DATE}
theme: ai-tutor
dek: "One canonical paper, read by mechanism family: a spine plus semi-autonomous modules, each under an explicit claim-status."
---

<!-- The page itself is the sibling ${SLUG}.html — a self-contained, generated techne
     document emitted by scripts/publish-atlas-to-site.js in the machinespirits-eval-dramatic
     repo from docs/research/atlas/atlas.yaml. This .md exists ONLY to give /essays its
     title/date/theme/dek and is kept older than the .html so ./build never Pandoc-renders
     over the generated page. Do not edit the .html here — edit the manifest and re-run. -->
`;

// ---- main -------------------------------------------------------------------
const man = YAML.parse(fs.readFileSync(MANIFEST, 'utf8'));
const version = paperVersion();
const mods = byN(man);

// Which built PDFs do we have?
const spinePdf = path.join(BUILD_DIR, 'spine.pdf');
const paperPdf = path.join(RESEARCH_DIR, `paper-2.0-v${version}.pdf`);
const paperPdfName = `paper-2.0-v${version}.pdf`;
const pdfPresent = new Set(mods.filter((m) => fs.existsSync(path.join(MODULES_DIR, `${m.id}.pdf`))).map((m) => m.id));

const DEST_HTML = path.join(DEST_DIR, `${SLUG}.html`);
const DEST_MD = path.join(DEST_DIR, `${SLUG}.md`);

const hub = genHub(man, version, pdfPresent, paperPdfName);

console.log(`atlas → machinespirits.org   [${DRY ? 'DRY RUN' : DO_PUBLISH ? 'STAGE + PUBLISH' : 'STAGE ONLY'}]`);
console.log(`  manifest  ${path.relative(REPO, MANIFEST)}  (${mods.length} modules, paper v${version})`);
console.log(`  hub    →  ${DEST_HTML}`);
console.log(`            ${(hub.length / 1024).toFixed(0)} KB · self-contained (techne.css+js inlined, fonts via CDN)`);
console.log(`  md     →  ${DEST_MD}  (frontmatter stub, backdated)`);
console.log(`  paper  →  articles/ai-tutor/${paperPdfName}  ${fs.existsSync(paperPdf) ? '·' : '✗ MISSING'}`);
console.log(`  spine  →  articles/ai-tutor/atlas/spine.pdf  ${fs.existsSync(spinePdf) ? '·' : '✗ MISSING'}`);
console.log(`  modules→  articles/ai-tutor/atlas/<id>.pdf  (${pdfPresent.size}/${mods.length} built)`);
for (const m of mods) console.log(`              ${pdfPresent.has(m.id) ? '·' : '✗ MISSING'} ${m.id}.pdf`);
console.log(`  public URL after deploy:  https://machinespirits.org/content/articles/ai-tutor/${SLUG}.html`);

if (DRY) {
  console.log('\n(dry run — nothing written)');
  process.exit(0);
}
if (!fs.existsSync(DEST_REPO)) {
  console.error(`\n✗ content-philosophy repo not found at ${DEST_REPO}`);
  process.exit(1);
}

fs.mkdirSync(DEST_ATLAS, { recursive: true });
fs.writeFileSync(DEST_MD, frontmatterStub);
fs.writeFileSync(DEST_HTML, hub);
// Backdate the .md a full minute so the .html is unambiguously newer and
// content-philosophy's ./build (1-second -nt granularity) leaves it alone.
const mdOld = new Date(Date.now() - 60_000);
fs.utimesSync(DEST_MD, mdOld, mdOld);

let copied = 0;
const copy = (from, to, label) => {
  if (!fs.existsSync(from)) {
    console.error(`  ✗ missing, skipped: ${label}`);
    return;
  }
  fs.copyFileSync(from, to);
  copied += 1;
};
copy(paperPdf, path.join(DEST_DIR, paperPdfName), paperPdfName);
copy(spinePdf, path.join(DEST_ATLAS, 'spine.pdf'), 'atlas/spine.pdf');
for (const m of mods) {
  const from = path.join(MODULES_DIR, `${m.id}.pdf`);
  if (fs.existsSync(from)) copy(from, path.join(DEST_ATLAS, `${m.id}.pdf`), `atlas/${m.id}.pdf`);
}
console.log(`\n✓ staged into ${DEST_REPO} (${copied} PDFs + hub + stub)`);

if (DO_PUBLISH) {
  console.log('\n→ content-philosophy ./publish (deploys to machinespirits.org, ~3-5 min)…\n');
  execFileSync('./publish', [`Publish research atlas (${SLUG}) + paper PDF v${version}`], {
    cwd: DEST_REPO,
    stdio: 'inherit',
  });
} else {
  console.log('\nNext — deploys to machinespirits.org (~3-5 min):');
  console.log(`  cd ${DEST_REPO} && ./publish "Publish research atlas + paper v${version}"`);
  console.log('  …or re-run this script with --publish');
}
