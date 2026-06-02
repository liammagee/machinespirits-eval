#!/usr/bin/env node
/**
 * generate-branch-status.js
 *
 * Regenerates the branch-status HTML note: where the current experimental
 * branch stands, what we set out to do, what the data shows, what's left.
 *
 * Auto-filled from live sources:
 *   - git: current branch, commits ahead of `--base`, diff shortstat, working tree
 *   - paper: version from front-matter, line numbers for §5.12 and §6.8
 *   - SQLite: per-cell adaptive-rubric scores from evaluation_results
 *
 * Hand-curated prose lives in the NARRATIVE block below — search/edit there
 * when running this before a draft is final.
 *
 * Usage:
 *   node scripts/generate-branch-status.js
 *   node scripts/generate-branch-status.js --open
 *   node scripts/generate-branch-status.js --out /tmp/x.html --base origin/main
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(__filename), '..');
const DB_PATH = path.join(REPO, 'data/evaluations.db');
const PAPER_PATH = path.join(REPO, 'docs/research/paper-full-2.0.md');
const DEFAULT_OUT =
  '/Users/lmagee/Dev/machinespirits/machinespirits-content-philosophy/articles/ai-tutor/branch-status.html';

// ---------- args -----------------------------------------------------------
const args = process.argv.slice(2);
const getFlag = (name) => args.includes(name);
const getOpt = (name, def) => {
  const i = args.indexOf(name);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : def;
};
const outPath = getOpt('--out', DEFAULT_OUT);
const baseBranch = getOpt('--base', 'main');
const openAfter = getFlag('--open');

// ---------- live data ------------------------------------------------------
const sh = (cmd) => execSync(cmd, { cwd: REPO, encoding: 'utf-8' }).trim();

const branch = sh('git branch --show-current');
const commitsAhead = sh(`git rev-list --count ${baseBranch}..HEAD`);
const diffShortstat = sh(`git diff --shortstat ${baseBranch}..HEAD`);
const wt = sh('git status --short').split('\n').filter(Boolean);
const modCount = wt.filter((l) => l.startsWith(' M') || l.startsWith('M ')).length;
const untrackedCount = wt.filter((l) => l.startsWith('??')).length;
const today = new Date().toISOString().slice(0, 10);

const paperText = readFileSync(PAPER_PATH, 'utf-8');
const paperVersion = (paperText.match(/^version:\s*"([^"]+)"/m) || [, 'unknown'])[1];
const findLine = (re) => {
  const lines = paperText.split('\n');
  for (let i = 0; i < lines.length; i++) if (re.test(lines[i])) return i + 1;
  return null;
};
const line512 = findLine(/^### 5\.12 /);
const line68 = findLine(/^### 6\.8 /);

const db = new Database(DB_PATH, { readonly: true });
const adaptiveRows = db
  .prepare(
    `
    SELECT
      profile_name,
      COUNT(*) AS n,
      ROUND(AVG(adaptive_trigger_recognition), 2) AS trig,
      ROUND(AVG(adaptive_strategy_execution), 2) AS exec_,
      ROUND(AVG(adaptive_strategy_quality), 2) AS qual,
      ROUND(AVG(adaptive_pedagogical_coherence), 2) AS coh,
      ROUND(AVG((adaptive_trigger_recognition + adaptive_strategy_execution
                + adaptive_strategy_quality + adaptive_pedagogical_coherence) / 4.0), 2) AS overall
    FROM evaluation_results
    WHERE adaptive_trigger_recognition IS NOT NULL
    GROUP BY profile_name
    ORDER BY profile_name
  `,
  )
  .all();
db.close();
const cell = (name) => adaptiveRows.find((r) => r.profile_name === name) || null;

// ============================================================================
// NARRATIVE — EDIT PER RUN
// ============================================================================
// Auto-fill above keeps numbers, version, line numbers, and counts fresh.
// Everything below is prose. Re-read it whenever the data shifts; especially
// when findings or framing change.
// ============================================================================

const NARRATIVE = {
  // ----- top-of-page vision / framing -------------------------------------
  vision: {
    project: `
      This is a research project on AI tutors built around the philosophical
      idea of <em>mutual recognition</em> — the Hegelian thesis that learning
      happens when teacher and student adjust to each other, not just when one
      transmits content to the other. The eval repo runs head-to-head
      comparisons across more than a hundred tutor "architectures" (indexed as
      <em>cells</em>) to find out which ingredients actually change how the
      tutor behaves and how a (sometimes simulated, sometimes human) learner
      responds. All durable findings live in a single canonical paper,
      <code>docs/research/paper-full-2.0.md</code>.
    `,
    branch: `
      The branch <code>experiment/langgraph-adaptive</code> is the most
      architecturally ambitious bet in the project so far. Instead of letting
      the tutor improvise turn-by-turn from a prompt, it gives the tutor
      three new pieces of scaffolding: an <strong>externalised model</strong>
      of the learner (a structured object the tutor reads and updates), a
      <strong>programmatic policy</strong> (a small library of named moves
      the tutor must choose between), and a <strong>counterfactual replay</strong>
      mechanism (re-running a turn under a different assumption to see which
      assumption the trajectory was sensitive to). To test whether the
      scaffolding actually pays off, we wrote <em>trap scenarios</em> with a
      pre-registered "expected strategy shift" — so we can measure adaptation
      directly instead of inferring it from rubric scores.
    `,
    direction: `
      The trap-scenario instrument works. The full adaptive runner does
      produce measurable strategy shifts on the trap suite — 47.8% strict /
      87.0% family on six scenarios at N=23 (<code>cell_110</code>). But the
      architectural elaborations we layered on top mostly didn't help:
      bilateral theory-of-mind didn't beat plain recognition (P2.1, null at
      N=24), and richer learner state was actually <em>worse</em> than minimal
      state (P2.2, <code>cell_118</code> beats <code>cell_110</code>). The
      head-to-head we most need — adaptive runner vs. a plain dialogue-engine
      baseline — was never actually run, despite the A13 pre-registration
      describing it. So the branch's contribution is reframing toward
      <strong>methodology</strong>: a working trap-scenario instrument and a
      LangGraph harness, plus a series of negative findings on the
      architectural bets made on top of it.
    `,
    next: `
      Three runs close most of the open questions. <strong>cell_120</strong>
      finishes the state-richness ablation. <strong>cell_106 N=32</strong>
      gives a defensible cross-architecture comparison against the
      id-director branch. <strong>cell_114</strong> — which still needs to be
      built — runs the dialogue-engine baseline on the trap suite, supplying
      the cross-family comparison the A13 pre-registration only described.
      A fourth task, an inter-rater rejudge on the adaptive grader, addresses
      the single-judge non-blinded caveat (§5.12.4). When those land, four
      §6.8 sub-subsections unblock and the paper drafts forward.
    `,
  },

  // ----- one-liner ---------------------------------------------------------
  oneLiner: `
    A LangGraph adaptive runner, a trap-scenario instrument, an adaptive
    graded rubric, and an A13 pre-registration were all built and ran; the
    headline experiments (<code>cell_110</code> baseline, P2.1 bilateral-ToM,
    P2.2 state-richness ablation) all completed; <strong>none of the
    architectural elaborations behaved the way the design hypothesised</strong>,
    and the dialogue-engine-on-trap-scenarios head-to-head implied by the A13
    pre-registration was never actually run. The paper now has a
    procedural-transparency section (§5.12) and an independent §6.8 block
    covering motivation, method, the cell_110 headline, and the P2.1 null —
    three more sub-subsections are queued behind pending runs.
  `,

  // ----- short prose intros for each main section --------------------------
  intros: {
    branch: `
      Concretely, the branch added a runner (<code>services/adaptiveTutor/*</code>),
      a trap-scenario instrument (<code>config/adaptive-trap-scenarios.yaml</code>),
      a graded rubric pipeline (<code>scripts/grade-adaptive-dialogue.js</code>), and
      cells 110–119 in <code>tutor-agents.yaml</code>. The headline new piece is the
      LangGraph state-machine runner: a small graph that reads externalised learner
      state, picks a programmatic policy action, calls the LLM with that action's
      prompt, updates state, and loops.
    `,
    paper: `
      The paper composes-as-we-go in normal flow — every experiment writes a few
      paragraphs into <code>paper-full-2.0.md</code> as it lands. Composition
      stalled for eleven days during this branch's work because the results kept
      changing the framing. Version 3.0.65 (today) restarts composition with
      §5.12 (procedural transparency about pre-registration drift) and §6.8
      (the architectural-extension story, partial — four sub-subsections drafted,
      four queued behind pending runs).
    `,
    findings: `
      Three results. A positive baseline finding that the adaptive runner does
      produce measurable strategy shifts on trap scenarios. A null on bilateral
      theory-of-mind elaboration. An inverted result where minimal-state beats
      full-state within the LangGraph family. The through-line: the adaptive
      <em>runner</em> works as a measurement instrument, but most of the
      architectural choices layered into it were not load-bearing.
    `,
    unestablished: `
      Three gaps in what we can claim. The big one is that the adaptive runner
      has never been compared against the dialogue-engine baseline at adequate
      N on the trap suite — the comparison the A13 pre-registration described
      as built turned out, when re-checked, to be entirely within the LangGraph
      family. Until <code>cell_114</code> runs, any "state machine beats dialogue
      engine" claim is unsupported.
    `,
    remaining: `
      Four tasks close the loop. Three are cheap (~30–60 min each, low cost);
      one needs design+build first (<code>cell_114</code>). After they land, four
      §6.8 sub-subsections unblock and the paper drafts forward.
    `,
  },

  // ----- strategy-shift binary numbers (from analyze-strategy-shift.js) ----
  strategyShift: {
    cell_110: { strict: 47.8, family: 87.0, scenarios: 6 },
    cell_118: { strict: 68.8, family: 96.9 },
    cell_119: { strict: 53.1, family: 84.4 },
    cell_111: { strict: 33.3 },
    cell_115: { strict: 45.8 },
    cell_116: { strict: 37.5 },
    cell_117: { strict: 33.3 },
  },
  p21: {
    pooledGapPp: 4.17,
    ciLow: -15.18,
    ciHigh: 23.52,
    threshold: 5,
  },

  // ----- §6.8 status table -------------------------------------------------
  paper68Status: [
    ['6.8.1', 'Motivation: Closing the §6.3.9 Gap', 'drafted', '—'],
    ['6.8.2', 'Method: Trap Scenarios, LangGraph Runner, Dual Scoring', 'drafted', '—'],
    ['6.8.3', 'Headline: cell_110 strategy shifts', 'drafted', '—'],
    ['6.8.4', 'Within-LangGraph A13 ablation', 'deferred', 'Re-judge / freeze on A13 final-run set'],
    ['6.8.5', 'Bilateral-ToM null (P2.1)', 'drafted', '—'],
    ['6.8.6', 'State-richness reversal (P2.2)', 'deferred', 'cell_120 run (~60 min)'],
    ['6.8.7', 'Cross-architecture status', 'blocked', 'cell_106 N=32; cell_114 dialogue-engine baseline'],
    ['6.8.8', 'Closing synthesis', 'blocked', 'All of the above'],
  ],

  paperEditsBeyond68: [
    '§6.3.9 needs a forward pointer into §6.8 (one sentence, post-§6.8 close-out).',
    '§8 limitations sub-subsection for the three caveats: no dialogue-engine baseline at headline N; A13 pre-reg drift; non-blinded graded rubric.',
    '§9 conclusion update once §6.8.8 lands.',
    'Reproducibility appendix: add <code>run_id</code>s for cell_110/111/112/113/115–119 (and 120, 114, 106-N32 once they land).',
  ],

  unestablished: [
    {
      title: 'No dialogue-engine baseline at headline N',
      body: `The trap suite has never been run through tutor-core's dialogue engine.
        The A13 pre-reg implied C1 (cell_111) and C2 (cell_112) would supply this comparison
        via <code>runner: standard</code>; in fact both cells carry <code>runner: adaptive</code>
        in YAML and are dispatched through LangGraph as <code>recognition_only</code> and
        <code>ego_superego</code> variants respectively. <strong>All four A13 conditions are
        LangGraph ablations.</strong> The head-to-head implied by the pre-reg does not exist
        in the data.`,
    },
    {
      title: 'Thin cross-architecture comparison',
      body: `Against id-director (cells 101–109), we have an N=6 pilot via
        <code>scripts/run-id-director-trap-pilot.js</code>. That's too thin for any
        architecture-vs-architecture claim.`,
    },
    {
      title: 'Mechanism claims mostly inverted',
      body: `The architectural commitments were: rich externalised state, programmatic
        policy, counterfactual replay. P2.1 falsified the bilateral elaboration. P2.2
        reversed the prediction about state richness. A13 counterfactual-divergence numbers
        were modest. Individually each is a finding; collectively they suggest the additions
        are not doing the work the design assumed.`,
    },
  ],

  remainingRuns: [
    [
      'cell_120 (state-policy, field isolation)',
      '~60 min',
      'low',
      'Closes the field-isolation question in P2.2; unblocks §6.8.6.',
      'queued',
    ],
    [
      'cell_106 N=32 (id-director on traps)',
      '~60 min',
      'low',
      'Lifts the N=6 pilot to defensible N; unblocks half of §6.8.7. Script exists, no new engineering.',
      'queued',
    ],
    [
      'cell_114 dialogue-engine baseline',
      'build + ~60 min run',
      'low',
      `Single most consequential addition; unblocks the other half of §6.8.7 and the §6.3.9
       forward pointer. Run plan written up in the parking note <em>Closing the dialogue-engine gap</em> section.`,
      'design done; build pending',
    ],
    [
      'Inter-rater rejudge on adaptive grader',
      '~30 min',
      'near-zero',
      'Best ROI move against the single-judge / non-blinded-rubric concern (§5.12.4).',
      'queued',
    ],
  ],
};

// ---------- HTML helpers ---------------------------------------------------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmtPct = (n) => (n === undefined || n === null ? '—' : `${n}%`);
const fmt = (n) => (n === undefined || n === null ? '—' : String(n));
const tagClass = {
  drafted: 'tag-done',
  null: 'tag-null',
  deferred: 'tag-pending',
  blocked: 'tag-blocked',
  queued: 'tag-pending',
  'design done; build pending': 'tag-pending',
};
const tag = (label) => `<span class="tag ${tagClass[label] || ''}">${label}</span>`;

const adaptiveTable = () => {
  const rows = [
    'cell_110_langgraph_adaptive',
    'cell_118_state_policy_minimal_profile',
    'cell_119_state_policy_no_misconceptions',
  ];
  const lookup = {
    cell_110_langgraph_adaptive: { label: 'cell_110', strip: '—', strictKey: 'cell_110' },
    cell_118_state_policy_minimal_profile: { label: 'cell_118', strip: 'profile fields', strictKey: 'cell_118' },
    cell_119_state_policy_no_misconceptions: {
      label: 'cell_119',
      strip: 'misconception tracking',
      strictKey: 'cell_119',
    },
  };
  return rows
    .map((name) => {
      const r = cell(name);
      const m = lookup[name];
      const ss = NARRATIVE.strategyShift[m.strictKey] || {};
      if (!r) return `<tr><td>${m.label}</td><td>${m.strip}</td><td colspan="8">(no rows in DB)</td></tr>`;
      return `<tr>
        <td>${m.label}</td><td>${m.strip}</td>
        <td class="num">${r.n}</td>
        <td class="num">${fmtPct(ss.strict)}</td>
        <td class="num">${fmtPct(ss.family)}</td>
        <td class="num">${r.trig}</td><td class="num">${r.exec_}</td>
        <td class="num">${r.qual}</td><td class="num">${r.coh}</td>
        <td class="num">${r.overall}</td>
      </tr>`;
    })
    .join('\n');
};

const p21Table = () => {
  const rows = [
    { cell: 'cell_111 (C1)', arch: 'recognition_only', key: 'cell_111' },
    { cell: 'cell_116', arch: 'recognition_only + named patterns', key: 'cell_116' },
    { cell: 'cell_115', arch: 'bilateral_tom', key: 'cell_115' },
    { cell: 'cell_117', arch: 'bilateral_tom + named patterns', key: 'cell_117' },
  ];
  return rows
    .map((r) => {
      const ss = NARRATIVE.strategyShift[r.key] || {};
      return `<tr><td>${r.cell}</td><td>${r.arch}</td><td class="num">${fmtPct(ss.strict)}</td><td class="num">${fmtPct(ss.family)}</td></tr>`;
    })
    .join('\n');
};

const paper68Table = () =>
  NARRATIVE.paper68Status
    .map(
      ([num, title, status, blocking]) =>
        `<tr><td>§${num}</td><td>${title}</td><td>${tag(status)}</td><td>${blocking}</td></tr>`,
    )
    .join('\n');

const remainingRunsTable = () =>
  NARRATIVE.remainingRuns
    .map(
      ([run, wall, cost, why, status]) =>
        `<tr><td><strong>${run}</strong></td><td>${wall}</td><td>${cost}</td><td>${why}</td><td>${tag(status)}</td></tr>`,
    )
    .join('\n');

const unestablishedBlocks = () =>
  NARRATIVE.unestablished.map((u, i) => `<h3>${i + 1}. ${u.title}</h3><p>${u.body.trim()}</p>`).join('\n');

const paperEditsList = () => NARRATIVE.paperEditsBeyond68.map((s) => `<li>${s}</li>`).join('\n');

const c110 = cell('cell_110_langgraph_adaptive');
const c110ss = NARRATIVE.strategyShift.cell_110;

// Sections registered for nav + search. Order = display order.
const SECTIONS = [
  ['vision', 'Vision and direction'],
  ['one-line', 'One-line state'],
  ['branch-changes', 'What this branch introduced'],
  ['paper-state', 'Where the paper stands'],
  ['findings', 'What we have found'],
  ['unestablished', 'What is not established'],
  ['remaining', 'Steps remaining'],
  ['refs', 'Pointers and regeneration'],
];
const nav = SECTIONS.map(([id, label]) => `<li><a href="#${id}" data-nav-link="${id}">${label}</a></li>`).join('\n');

// ---------- render ---------------------------------------------------------
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Branch status — ${esc(branch)} — ${today}</title>
<style>
  :root {
    --paper: #faf8f3;
    --ink: #1f1a17;
    --muted: #6e6660;
    --rule: #d8d2c6;
    --accent: #6e1923;
    --accent-soft: rgba(110, 25, 35, 0.06);
    --code-bg: #f0ebde;
    --warn: #8a5a00;
    --null: #6e6660;
    --pos: #2a6b2e;
    color-scheme: light dark;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --paper: #18171a;
      --ink: #ece6dd;
      --muted: #8a807a;
      --rule: #2c2a2e;
      --accent: #c98995;
      --accent-soft: rgba(201, 137, 149, 0.08);
      --code-bg: #232026;
      --warn: #d6a86a;
      --null: #9a948c;
      --pos: #9bc99b;
    }
  }
  * { box-sizing: border-box; }
  html, body { background: var(--paper); color: var(--ink); }
  body {
    font-family: "Charter", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
    line-height: 1.6;
    margin: 0; padding: 0;
    -webkit-font-smoothing: antialiased;
    font-size: 16.5px;
  }
  .layout {
    display: grid;
    grid-template-columns: 240px minmax(0, 1fr);
    gap: 2.4rem;
    max-width: 78rem;
    margin: 0 auto;
    padding: 2rem 1.5rem 6rem;
  }
  aside.sidebar {
    position: sticky;
    top: 1.5rem;
    align-self: start;
    border-right: 1px solid var(--rule);
    padding-right: 1.2rem;
    font-size: 0.94rem;
    max-height: calc(100vh - 3rem);
    overflow-y: auto;
  }
  aside.sidebar h2 {
    font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.14em;
    color: var(--accent); margin: 1.4rem 0 0.4rem; border: none; padding: 0;
  }
  aside.sidebar h2:first-child { margin-top: 0; }
  aside.sidebar ul { list-style: none; margin: 0 0 1rem; padding: 0; }
  aside.sidebar li { margin: 0.18rem 0; }
  aside.sidebar a {
    color: var(--ink); text-decoration: none; display: block;
    padding: 0.15rem 0.45rem; border-radius: 3px;
    border-left: 2px solid transparent;
  }
  aside.sidebar a:hover { background: var(--accent-soft); }
  aside.sidebar a.active {
    color: var(--accent); border-left-color: var(--accent);
    background: var(--accent-soft);
  }
  .search {
    display: flex; align-items: center; gap: 0.4rem;
    border: 1px solid var(--rule); border-radius: 6px;
    padding: 0.4rem 0.6rem;
    margin-bottom: 1.2rem;
    background: var(--paper);
  }
  .search input {
    flex: 1; border: 0; outline: 0; background: transparent;
    color: var(--ink); font: inherit; font-size: 0.92rem;
  }
  .search button {
    border: 0; background: transparent; color: var(--muted);
    cursor: pointer; font-size: 0.92rem; padding: 0; display: none;
  }
  .search.has-q button { display: inline-block; }
  .hit-count {
    font-size: 0.78rem; color: var(--muted); margin: -0.6rem 0 1rem;
  }
  main { min-width: 0; }
  header.page {
    border-bottom: 1px solid var(--rule);
    padding-bottom: 1.4rem; margin-bottom: 2rem;
  }
  .eyebrow {
    font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.14em;
    color: var(--accent); margin: 0 0 0.4rem; font-weight: 600;
  }
  h1 { font-size: 1.95rem; margin: 0 0 0.35rem; letter-spacing: -0.01em; line-height: 1.2; }
  .subtitle { color: var(--muted); font-size: 1.0rem; margin: 0.3rem 0 0; font-style: italic; }
  .meta { color: var(--muted); font-size: 0.88rem; margin-top: 0.8rem; }
  .meta code { font-style: normal; }
  h2 {
    font-size: 1.4rem; margin: 2.4rem 0 0.6rem; color: var(--accent);
    border-bottom: 1px solid var(--rule); padding-bottom: 0.3rem;
    letter-spacing: -0.005em;
  }
  h3 { font-size: 1.07rem; margin: 1.5rem 0 0.4rem; }
  h4 { font-size: 0.95rem; margin: 1rem 0 0.3rem; color: var(--muted); font-weight: 600; }
  p { margin: 0.5rem 0 0.9rem; }
  .lede {
    font-size: 1.05rem; color: var(--ink);
    border-left: 3px solid var(--accent); padding: 0.1rem 0 0.1rem 0.9rem;
    margin: 0.6rem 0 1.2rem;
  }
  code, pre {
    font-family: "SF Mono", "Menlo", "Consolas", monospace;
    background: var(--code-bg);
    border-radius: 3px;
  }
  code { padding: 0.05em 0.35em; font-size: 0.86em; }
  pre {
    padding: 0.7em 0.9em; overflow-x: auto; font-size: 0.83em; line-height: 1.45;
    border: 1px solid var(--rule);
  }
  table {
    border-collapse: collapse;
    margin: 0.7rem 0 1.2rem 0;
    font-size: 0.92em; width: 100%;
  }
  th, td {
    border: 1px solid var(--rule); padding: 0.4em 0.7em;
    text-align: left; vertical-align: top;
  }
  th { background: var(--accent-soft); font-weight: 600; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  ul { padding-left: 1.4em; }
  li { margin: 0.25em 0; }
  .tag {
    display: inline-block; font-size: 0.72em; padding: 1px 7px; border-radius: 9px;
    margin-right: 0.4em; background: var(--code-bg); color: var(--muted);
    font-variant: small-caps; letter-spacing: 0.04em;
  }
  .tag-done { background: rgba(42, 107, 46, 0.14); color: var(--pos); }
  .tag-null { background: rgba(110, 102, 96, 0.18); color: var(--null); }
  .tag-pending { background: rgba(138, 90, 0, 0.16); color: var(--warn); }
  .tag-blocked { background: rgba(155, 50, 38, 0.15); color: #b04030; }
  mark {
    background: rgba(255, 220, 0, 0.55); color: inherit; padding: 0.05em 0.1em; border-radius: 2px;
  }
  @media (prefers-color-scheme: dark) {
    mark { background: rgba(255, 220, 0, 0.28); }
  }
  section.block { scroll-margin-top: 1.5rem; }
  section.block.hidden { display: none; }
  .footer-note {
    font-size: 0.84rem; color: var(--muted); margin-top: 3rem;
    border-top: 1px solid var(--rule); padding-top: 1rem;
  }
  @media (max-width: 880px) {
    .layout { grid-template-columns: 1fr; gap: 1.4rem; padding-top: 1.4rem; }
    aside.sidebar { position: static; max-height: none; border-right: 0; border-bottom: 1px solid var(--rule); padding: 0 0 1rem; }
  }
</style>
</head>
<body>

<div class="layout">

<aside class="sidebar" aria-label="Navigation">
  <div class="search" id="searchBox">
    <input id="searchInput" type="search" placeholder="Search sections…" autocomplete="off" />
    <button id="searchClear" type="button" title="Clear">✕</button>
  </div>
  <div class="hit-count" id="hitCount"></div>
  <h2>Contents</h2>
  <ul id="navList">
${nav}
  </ul>
  <h2>Regenerate</h2>
  <ul>
    <li><code>node scripts/<br>generate-branch-<br>status.js --open</code></li>
  </ul>
</aside>

<main>

<header class="page">
  <p class="eyebrow">Internal status note · ${today}</p>
  <h1>Branch: <code>${esc(branch)}</code></h1>
  <p class="subtitle">Where this experimental arc landed, what it shows, what's left to run.</p>
  <p class="meta">
    Base <code>${esc(baseBranch)}</code> · ${commitsAhead} commits ahead ·
    ${esc(diffShortstat)} · ${modCount} modified + ${untrackedCount} untracked in working tree.
    Paper: <code>docs/research/paper-full-2.0.md</code> v${esc(paperVersion)}.
  </p>
</header>

<section class="block" id="vision">
  <h2>0. Vision and direction</h2>

  <h3>0.1 What the project is for</h3>
  <p class="lede">${NARRATIVE.vision.project.trim()}</p>

  <h3>0.2 What this branch was trying to do</h3>
  <p>${NARRATIVE.vision.branch.trim()}</p>

  <h3>0.3 Where this leaves us</h3>
  <p>${NARRATIVE.vision.direction.trim()}</p>

  <h3>0.4 What unblocks the next draft</h3>
  <p>${NARRATIVE.vision.next.trim()}</p>
</section>

<section class="block" id="one-line">
  <h2>1. One-line state</h2>
  <p>${NARRATIVE.oneLiner.trim()}</p>
</section>

<section class="block" id="branch-changes">
  <h2>2. What this branch introduced</h2>
  <p class="lede">${NARRATIVE.intros.branch.trim()}</p>

  <h3>2.1 Core code (<code>services/adaptiveTutor/</code>)</h3>
  <ul>
    <li><code>graph.js</code> — LangGraph state-policy + counterfactual replay; dispatches by <code>adaptive.architecture</code> (<code>recognition_only</code>, <code>ego_superego</code>, <code>state_policy</code>, <code>state_policy_with_validator</code>, <code>bilateral_tom</code>).</li>
    <li><code>runner.js</code>, <code>index.js</code> — orchestration; <code>--max-cost</code> guard wired through.</li>
    <li><code>stateSchema.js</code> — externalised learner-state schema (profile, misconceptions, history, hypotheses).</li>
    <li><code>policyActions.js</code> + <code>config/adaptive-policy-actions.yaml</code> — taxonomy of programmatic moves.</li>
    <li><code>realLLM.js</code>, <code>mockLLM.js</code>, <code>llm.js</code> — provider adapters; mock backend gives deterministic smoke runs with zero API spend.</li>
    <li><code>persistence.js</code> — writes <code>adaptive_trigger_recognition</code>, <code>adaptive_strategy_execution</code>, <code>adaptive_strategy_quality</code>, <code>adaptive_pedagogical_coherence</code>, <code>adaptive_grader_*</code>, plus <code>scenario_id</code> linkage.</li>
    <li><code>budgetTracker.js</code> — per-run token + cost accounting, persisted via snapshot+delta.</li>
  </ul>

  <h3>2.2 Config</h3>
  <ul>
    <li><code>config/adaptive-trap-scenarios.yaml</code> — 8 trap scenarios with <code>hidden.actualMisconception</code>, <code>hidden.triggerTurn</code>, <code>hidden.triggerSignal</code>, <code>expectedStrategyShift</code>, <code>failure_mode</code>, <code>success_criteria</code>.</li>
    <li><code>config/adaptive-trap-scenarios-v2.yaml</code> (uncommitted) — v2 set with sharper trigger signals; used for P2.1 N=24 fan-out.</li>
    <li><code>config/tutor-agents.yaml</code> — added cells 110, 111, 112, 113 (A13 C3/C1/C2/C4); cells 115/116/117 (bilateral-ToM family); cells 118/119 (state-schema ablation: minimal profile, no misconceptions).</li>
  </ul>

  <h3>2.3 Scripts</h3>
  <ul>
    <li><code>scripts/analyze-strategy-shift.js</code> — primary binary endpoint (<code>strict</code>/<code>family</code>); exports per-cell counts and CIs.</li>
    <li><code>scripts/grade-adaptive-dialogue.js</code> — 4-dim graded rubric scoring (post-hoc, non-blinded; documented in §5.12.4).</li>
    <li><code>scripts/run-adaptive-cell-smoke.js</code>, <code>scripts/run-adaptive-persistence-smoke.js</code>, <code>scripts/run-langgraph-smoke.js</code> — hermetic smokes against <code>mktemp -d</code> tmp DB + logs with <code>ADAPTIVE_TUTOR_LLM=mock</code>.</li>
    <li><code>scripts/run-id-director-trap-pilot.js</code> — cell_106 (id-director) against the trap suite; N=6 pilot, ready to re-run at N=32.</li>
    <li><code>scripts/launch-p21-fanout.sh</code>, <code>scripts/resume-quota-wall.sh</code> — operational helpers for the long fan-out.</li>
    <li><code>scripts/chat-cli.js</code> — terminal chat CLI (separate utility, came along on this branch).</li>
    <li><code>scripts/generate-branch-status.js</code> — generator for this very note.</li>
  </ul>

  <h3>2.4 Documentation</h3>
  <table>
    <tr><th>File</th><th>What it covers</th></tr>
    <tr><td><code>a13-pre-registration.md</code></td><td>Original A13 design (C1–C4). Carries the drift documented in §5.12.2.</td></tr>
    <tr><td><code>a13-gate-b-results.md</code></td><td>Gate B (real-LLM) results memo + diagnostics.</td></tr>
    <tr><td><code>a13-followup-N24-granular-results.md</code></td><td>Per-scenario granular numbers from N=24 fan-out.</td></tr>
    <tr><td><code>p2-bilateral-tom-pre-registration.md</code></td><td>P2 design: bilateral ToM elaboration vs recognition_only.</td></tr>
    <tr><td><code>p21-N24-results.md</code></td><td>P2.1 results: bilateral-ToM null at N=24.</td></tr>
    <tr><td><code>p22-p23-parking-note.md</code></td><td>State-richness reversal (P2.2), what's defensible vs unestablished, §6 integration plan, cell_114 run plan.</td></tr>
    <tr><td><code>state-schema-ablation-design.md</code></td><td>Cell 118/119/120 design.</td></tr>
    <tr><td><code>bilateral-tom-id-director-crossover-design.md</code></td><td>Crossover proposal (parked).</td></tr>
    <tr><td><code>primitives-qualitative-pilot-*.md</code></td><td>Qualitative pilot trio (design / findings / followup).</td></tr>
    <tr><td><code>gpt-pro/01–03</code> + <code>literature/INDEX.md</code></td><td>Resource indices for the renovation strategy work.</td></tr>
  </table>

  <h3>2.5 Paper edits on this branch</h3>
  <ul>
    <li><strong>§5.12 Procedural Transparency</strong> (<code>paper-full-2.0.md:${line512 ?? '?'}</code>). Six sub-subsections covering pre-reg drift principle, A13 specific drift, cell_114 post-hoc baseline, non-blinded graded rubric, stimulus-suite divergence, three-tier reporting convention.</li>
    <li><strong>§6.8 Architectural Extension</strong> (<code>paper-full-2.0.md:${line68 ?? '?'}</code>). Independent block; partial — see table in §3.1 below.</li>
    <li>Version bumped to <code>${esc(paperVersion)}</code> with revision-history entry.</li>
  </ul>
</section>

<section class="block" id="paper-state">
  <h2>3. Where the paper stands</h2>
  <p class="lede">${NARRATIVE.intros.paper.trim()}</p>

  <h3>3.1 §6.8 sub-subsection state</h3>
  <table>
    <tr><th>Section</th><th>Title</th><th>Status</th><th>Blocking</th></tr>
    ${paper68Table()}
  </table>

  <h3>3.2 Edits beyond §6.8 still owed</h3>
  <ul>
  ${paperEditsList()}
  </ul>
</section>

<section class="block" id="findings">
  <h2>4. What we have found</h2>
  <p class="lede">${NARRATIVE.intros.findings.trim()}</p>

  <h3>4.1 cell_110 baseline on trap scenarios (§6.8.3)</h3>
  <p>
    Strict binary <code>strategy_shift_correctness</code> = <strong>${fmtPct(c110ss.strict)}</strong>;
    family-match = <strong>${fmtPct(c110ss.family)}</strong>; N=${c110?.n ?? '?'}, scenarios=${c110ss.scenarios ?? '?'}.
    Graded 4-dim adaptive rubric overall <strong>${fmt(c110?.overall)} / 5</strong>, with pedagogical-coherence trailing
    (${fmt(c110?.coh)}). First headline-N measurement that an adaptive architecture produces measurable
    trigger-driven strategy shifts on a pre-registered trap suite. ${tag('drafted')}
  </p>

  <h3>4.2 P2.1 — Bilateral-ToM null (§6.8.5)</h3>
  <p>
    Bilateral-ToM elaboration over <code>recognition_only</code> showed no within-family discrimination on N=24 across four v2 cells.
  </p>
  <table>
    <tr><th>Cell</th><th>Arch</th><th>Strict</th><th>Family</th></tr>
    ${p21Table()}
  </table>
  <p>
    Pooled bilateral-vs-recognition gap = <strong>+${NARRATIVE.p21.pooledGapPp}pp</strong>,
    CI [${NARRATIVE.p21.ciLow}, +${NARRATIVE.p21.ciHigh}]. Falls below the pre-registered
    ≥${NARRATIVE.p21.threshold}pp threshold ⇒ null. ${tag('null')}
  </p>

  <h3>4.3 P2.2 — State-richness reversal (deferred to §6.8.6)</h3>
  <p>Within the state-machine family, <strong>less learner state is more</strong>:</p>
  <table>
    <tr><th>Cell</th><th>What's stripped</th><th>N</th><th>Strict</th><th>Family</th>
        <th>trig</th><th>exec</th><th>qual</th><th>coh</th><th>graded</th></tr>
    ${adaptiveTable()}
  </table>
  <p>
    cell_118 (minimal profile) beats cell_110 (full state) on both binary and graded scoring. cell_119 (no misconceptions)
    lands between them. The architectural commitment to rich externalised state did not pay off in the headline metric.
    ${tag('drafted')} (with engineering-vs-noise caveats from the parking note — single-judge, non-blinded rubric,
    scale-of-effect modest).
  </p>

  <h3>4.4 Methodology contribution</h3>
  <p>
    Externally-defined <code>expectedStrategyShift</code> + counterfactual replay + binary correctness gave a measurable
    phenomenon to study. The <strong>instrument</strong> is a contribution distinct from the architecture it was used to
    test. Multiple null / inverted results from the architectural elaborations are also a contribution.
  </p>
</section>

<section class="block" id="unestablished">
  <h2>5. What is not established</h2>
  <p class="lede">${NARRATIVE.intros.unestablished.trim()}</p>
  ${unestablishedBlocks()}
</section>

<section class="block" id="remaining">
  <h2>6. Steps remaining</h2>
  <p class="lede">${NARRATIVE.intros.remaining.trim()}</p>

  <h3>6.1 Runs queued</h3>
  <table>
    <tr><th>Run</th><th>Wallclock</th><th>Cost</th><th>Why it matters</th><th>Status</th></tr>
    ${remainingRunsTable()}
  </table>

  <h3>6.2 Paper edits queued behind those runs</h3>
  <ul>
    <li>§6.8.4 — within-LangGraph A13 ablation. Numbers in hand; waiting on inter-rater rejudge before locking framing.</li>
    <li>§6.8.6 — state-richness reversal. Waiting on cell_120.</li>
    <li>§6.8.7 — cross-architecture status. Waiting on cell_106 N=32 + cell_114.</li>
    <li>§6.8.8 — closing synthesis. Waits on all of the above.</li>
    <li>§6.3.9 forward pointer; §8 limitations sub-subsection; §9 conclusion update; reproducibility-appendix run-id additions.</li>
  </ul>

  <h3>6.3 Working-tree hygiene before merge</h3>
  <p>
    Working tree carries ${modCount} modified + ${untrackedCount} untracked files relative to last commit.
    Modifications are mostly LangGraph runner internals and evaluation pipeline; untracked items are the new exploration
    docs and the v2 trap-scenarios YAML. None of this is risky to commit; the question is sequencing — bundle paper edits
    separately from experimental docs, or land together.
  </p>
</section>

<section class="block" id="refs">
  <h2>7. Pointers and regeneration</h2>

  <h3>7.1 Where to look</h3>
  <ul>
    <li><strong>Paper</strong>: <code>docs/research/paper-full-2.0.md</code> v${esc(paperVersion)} — §5.12 at line ${line512 ?? '?'}, §6.8 at line ${line68 ?? '?'}.</li>
    <li><strong>Parking note</strong> (operational source-of-truth for this arc): <code>docs/explorations/claude/p22-p23-parking-note.md</code>.</li>
    <li><strong>Pre-regs</strong>: <code>a13-pre-registration.md</code>, <code>p2-bilateral-tom-pre-registration.md</code>, <code>p2-followup-pre-registration.md</code>.</li>
    <li><strong>Results memos</strong>: <code>a13-gate-b-results.md</code>, <code>a13-followup-N24-granular-results.md</code>, <code>p21-N24-results.md</code>.</li>
    <li><strong>Adaptive runner</strong>: <code>services/adaptiveTutor/</code>; entry <code>index.js</code>; dispatch logic <code>graph.js</code>.</li>
    <li><strong>Trap scenarios</strong>: <code>config/adaptive-trap-scenarios.yaml</code> (v1), <code>config/adaptive-trap-scenarios-v2.yaml</code> (v2, uncommitted).</li>
    <li><strong>Cell registry</strong>: <code>config/tutor-agents.yaml</code> + <code>EVAL_ONLY_PROFILES</code> in <code>services/evaluationRunner.js</code> (~line 102).</li>
    <li><strong>Smokes</strong>: <code>scripts/run-adaptive-cell-smoke.js</code> with <code>ADAPTIVE_TUTOR_LLM=mock</code> — no paid API calls.</li>
  </ul>

  <h3>7.2 Regenerate this note</h3>
  <p>
    This document is generated by <code>scripts/generate-branch-status.js</code>. Mechanical
    data (git counts, paper line numbers, per-cell SQL aggregates) refreshes on every run.
    Narrative prose lives in a <code>NARRATIVE</code> block at the top of the script — edit
    there before re-running so the prose stays in source control.
  </p>
  <pre><code>node scripts/generate-branch-status.js              # write to default path
node scripts/generate-branch-status.js --open       # ...and open in browser
node scripts/generate-branch-status.js --out /tmp/x.html --base origin/main</code></pre>

  <p class="footer-note">
    Internal status note, not part of the paper. Numbers from <code>data/evaluations.db</code>
    + git + paper front-matter; prose from the NARRATIVE block in
    <code>scripts/generate-branch-status.js</code>. The paper itself remains the canonical
    record for any claim that survives review.
  </p>
</section>

</main>
</div>

<script>
  // -------- Search: filter sections by keyword --------
  const input = document.getElementById('searchInput');
  const clearBtn = document.getElementById('searchClear');
  const box = document.getElementById('searchBox');
  const hitCount = document.getElementById('hitCount');
  const sections = Array.from(document.querySelectorAll('section.block'));
  const navLinks = Array.from(document.querySelectorAll('[data-nav-link]'));

  function clearMarks(root) {
    root.querySelectorAll('mark').forEach((m) => {
      const t = document.createTextNode(m.textContent);
      m.parentNode.replaceChild(t, m);
    });
  }
  function highlight(root, q) {
    if (!q) return 0;
    const re = new RegExp(q.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&'), 'gi');
    let count = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (['SCRIPT', 'STYLE', 'MARK'].includes(node.parentNode.nodeName)) return NodeFilter.FILTER_REJECT;
        return re.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach((node) => {
      const frag = document.createDocumentFragment();
      let last = 0;
      const text = node.nodeValue;
      text.replace(re, (m, off) => {
        if (off > last) frag.appendChild(document.createTextNode(text.slice(last, off)));
        const el = document.createElement('mark');
        el.textContent = m;
        frag.appendChild(el);
        count++;
        last = off + m.length;
        return m;
      });
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
    return count;
  }
  function doSearch() {
    const q = input.value.trim();
    sections.forEach((s) => clearMarks(s));
    if (!q) {
      box.classList.remove('has-q');
      sections.forEach((s) => s.classList.remove('hidden'));
      hitCount.textContent = '';
      return;
    }
    box.classList.add('has-q');
    let total = 0;
    let visible = 0;
    sections.forEach((s) => {
      const c = highlight(s, q);
      total += c;
      if (c > 0) {
        s.classList.remove('hidden');
        visible++;
      } else {
        s.classList.add('hidden');
      }
    });
    hitCount.textContent = total === 0 ? 'No matches' : (total + ' match' + (total === 1 ? '' : 'es') + ' in ' + visible + ' section' + (visible === 1 ? '' : 's'));
  }
  input.addEventListener('input', doSearch);
  clearBtn.addEventListener('click', () => { input.value = ''; doSearch(); input.focus(); });

  // -------- Active nav link on scroll --------
  const idToLink = Object.fromEntries(navLinks.map((a) => [a.dataset.navLink, a]));
  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          navLinks.forEach((a) => a.classList.remove('active'));
          const link = idToLink[e.target.id];
          if (link) link.classList.add('active');
        }
      });
    },
    { rootMargin: '-30% 0px -65% 0px' },
  );
  sections.forEach((s) => obs.observe(s));

  // -------- '/' shortcut focuses search --------
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== input) {
      e.preventDefault();
      input.focus();
    }
    if (e.key === 'Escape' && document.activeElement === input) {
      input.value = '';
      doSearch();
      input.blur();
    }
  });
</script>

</body>
</html>
`;

writeFileSync(outPath, html);
console.log(`Wrote ${outPath}`);
console.log(`  branch=${branch} · ${commitsAhead} ahead of ${baseBranch} · paper v${paperVersion}`);
console.log(`  ${diffShortstat} · ${modCount} modified + ${untrackedCount} untracked`);
console.log(`  §5.12 @ line ${line512} · §6.8 @ line ${line68}`);
console.log(`  ${adaptiveRows.length} cells with adaptive-rubric rows in DB`);
if (openAfter) execSync(`open "${outPath}"`);
