/**
 * Adversarial claim-integrity re-audit of the canonical Paper 2.0.  (v2 — batched)
 *
 * The last full sweep was 2026-06-06 at paper v3.0.126 (TODO.md §G, all five closed).
 * The paper is now well past that — the whole dramatic-derivation arc (§6.13.x) and
 * many versions of edits have never been through the verifier. This re-runs the sweep:
 * every empirical/numeric claim must trace to a DB query, a committed read-only script,
 * or a cited source; anything that doesn't gets flagged.
 *
 * v2 design note: v1 spawned one verify agent PER CLAIM plus a skeptic, which on a
 * 4,649-line paper produced many hundreds of claims, blew the 1000-agent workflow cap,
 * and triggered server-side rate-limiting so nearly every agent failed. v2 BATCHES:
 * one agent per ~460-line chunk does extract AND verify for every claim in its range
 * (its own read-only sqlite queries), so the whole paper is ~10-12 agents, not ~1000.
 * The per-claim adversarial second opinion is dropped here (it was the main cost driver);
 * single-pass verdicts with stated evidence catch the tracing/number errors that matter.
 *
 * READ-ONLY + NO PAID CALLS by construction (see GROUND_RULES). Output:
 * exports/claim-verify-findings.md (new "Run N" section).
 *
 * Launch:   Workflow({ scriptPath: "claim-verify-audit.workflow.js" })
 * Smoke:    Workflow({ scriptPath: "claim-verify-audit.workflow.js", args: { maxChunks: 1 } })
 * Resume:   Workflow({ scriptPath: "claim-verify-audit.workflow.js", resumeFromRunId: "<runId>" })
 * Args:     { paperPath?: string, maxChunks?: number }
 */

export const meta = {
  name: 'claim-verify-audit',
  description: 'Adversarial claim-integrity re-audit of paper-full-2.0.md (read-only, no paid calls, batched)',
  whenToUse: 'Re-verify every empirical/numeric claim in the canonical paper traces to the DB or a committed script.',
  phases: [
    { title: 'Scout', detail: 'map section headings + line ranges' },
    { title: 'Audit', detail: 'one agent per chunk: extract + verify all its claims' },
    { title: 'Synthesize', detail: 'write exports/claim-verify-findings.md Run N' },
  ],
};

const PAPER = (args && args.paperPath) || 'docs/research/paper-full-2.0.md';
const MAX_CHUNKS = args && args.maxChunks ? Number(args.maxChunks) : null;
const TARGET_CHUNK_LINES = 460;

// ----------------------------------------------------------------------------
// Schemas
// ----------------------------------------------------------------------------
const SCOUT_SCHEMA = {
  type: 'object',
  properties: {
    totalLines: { type: 'number' },
    paperVersion: { type: 'string' },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          level: { type: 'number' },
          title: { type: 'string' },
          startLine: { type: 'number' },
        },
        required: ['level', 'title', 'startLine'],
      },
    },
  },
  required: ['totalLines', 'paperVersion', 'sections'],
};

// One combined record per claim: extracted AND verified by the same chunk agent.
const CHUNK_FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    claims: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          section: { type: 'string' },
          line: { type: 'number' },
          text: { type: 'string' },
          claimed_value: { type: 'string' },
          claim_type: {
            type: 'string',
            enum: [
              'effect_size',
              'n_count',
              'p_value',
              'percentage',
              'mean_sd',
              'correlation',
              'comparative',
              'ratio',
              'other',
            ],
          },
          verdict: {
            type: 'string',
            enum: ['supported', 'unsupported', 'untraceable', 'low_confidence', 'needs_paid_repro'],
          },
          source: { type: 'string' }, // exact query/command/doc:line used (or tried)
          reproduced_value: { type: 'string' }, // what ground truth returned
          discrepancy: { type: 'string' }, // "" if claimed == reproduced
          severity: { type: 'string', enum: ['critical', 'major', 'minor', 'none'] },
          evidence: { type: 'string' },
        },
        required: [
          'section',
          'line',
          'text',
          'claimed_value',
          'claim_type',
          'verdict',
          'source',
          'reproduced_value',
          'discrepancy',
          'severity',
          'evidence',
        ],
      },
    },
  },
  required: ['claims'],
};

// ----------------------------------------------------------------------------
// Rules block reused in every chunk-audit prompt — the offline-safety seam.
// ----------------------------------------------------------------------------
const GROUND_RULES = `
OFFLINE / READ-ONLY — this audit runs unattended. Hard rules:
- NEVER make a paid API/model call. Do NOT run: eval-cli run/evaluate/rejudge/resume, any
  drama generator (generate-pedagogical-dramas, drama-generator), assess-transcripts,
  qualitative-analysis-ai, code-impasse/code-dialectical, calibrate-rubric --live, or ANY
  script that generates/judges/embeds. If a number can only be reproduced by a paid run,
  return verdict "needs_paid_repro".
- The DB is read-only here: SELECT only, never write. Query it with:
    sqlite3 data/evaluations.db "SELECT ..."        (or the evaluations-db MCP read_query tool)
- DB rules (from CLAUDE.md): always filter by judge_model; the canonical Turn-0 tutor column is
  tutor_first_turn_score (overall_score is a deprecated alias; tutor_overall_score is the per-turn
  aggregate — use whichever the claim's context names); there is NO "trace" column; match cells
  across runs with LIKE 'cell_N%'; respect rubric_version and NEVER compare numbers across versions.
- Other ground truth (reading files is always fine): committed read-only analysis scripts in
  scripts/ (e.g. analyze-rubric-pca.js, analyze-a7-h2-slope.js, analyze-superego-taxonomy.js,
  analyze-eval-results.js); config/paper-manifest.json (N-counts + figure composition); the
  reproduction reports in exports/*.md; provenance in notes/. If unsure whether a script makes
  network calls, DON'T run it — reproduce the number with a direct sqlite3 SELECT instead, or
  return "needs_paid_repro".
- Adversarial stance: assume each claim is WRONG until ground truth confirms it. "supported"
  requires you to have actually reproduced the value (state the query/command + the value it
  returned). If you cannot locate any source, that is "untraceable", not "low_confidence".
`;

// ----------------------------------------------------------------------------
// Prompts
// ----------------------------------------------------------------------------
const scoutPrompt = () => `
Map the structure of the paper at ${PAPER}.

Use Bash:
  - headings + line numbers:  grep -nE '^#{1,4} ' ${PAPER}
  - total lines:              wc -l < ${PAPER}
  - version:                  grep -nE '^version:' ${PAPER} | head -1

Return totalLines, paperVersion (the value of the YAML version: field, e.g. "3.0.166"),
and one sections[] entry per heading: { level (number of leading #), title, startLine }.
Return ALL headings in document order. Do not extract claims — structure only.`;

const auditPrompt = (chunk, idx, total) => `
You are auditing one slice of ${PAPER} (slice ${idx + 1}/${total}). In ONE pass you will both
EXTRACT every empirical/numeric claim in this slice and VERIFY each against ground truth.

Read ${PAPER} lines ${chunk.start}–${chunk.end} (read ~20 lines past the end for context):
  use Read with offset=${chunk.start}, limit=${chunk.end - chunk.start + 21}.
Sections in this slice: ${chunk.titles.join(' | ')}

STEP 1 — EXTRACT every empirical/numeric claim. These count:
  effect sizes (Cohen's d, η², odds), N-counts, p-values, percentages, means±SD, correlations
  (r, ρ), ratios / "Nx more often", counts of cells/runs/dialogues, and explicit empirical
  comparatives ("recognition scored higher than base", "null at the pre-registered gate",
  "X/Y arms grounded"). SKIP pure theory/framing, external-literature citations, method
  descriptions with no number, and headings. Be exhaustive within your slice.

STEP 2 — VERIFY each claim against ground truth, then classify:
  supported        — reproduced and matches (small N drift from a snapshot is fine; say so).
  unsupported      — traced to a source but the number genuinely disagrees.
  untraceable      — no source found in DB, scripts, manifest, or cited docs.
  needs_paid_repro — only a paid generation/judge/embed run could confirm it.
  low_confidence   — source ambiguous or claim too vague to bind to one number.
For each claim record: section, line, exact claim text, claimed_value, claim_type, verdict,
source (the EXACT sqlite query / command / doc:line you used), reproduced_value, discrepancy
("" if it matches), severity (critical = a wrong load-bearing number; major = wrong/untraceable
but bounded; minor = provenance/specificity only; none = clean), and a one-sentence evidence note.

${GROUND_RULES}

Work efficiently: batch your sqlite lookups where claims share a run/column. Return ALL claims
for your slice (supported ones too) so the harness can count coverage.`;

const synthPrompt = (summary, compact) => `
Write the Run N section of the claim-integrity audit report.

Summary (computed deterministically by the harness — use these numbers verbatim):
${JSON.stringify(summary, null, 2)}

Flagged claims (everything not cleanly "supported"):
${JSON.stringify(compact, null, 2)}

Steps:
  1. Stamp the date with Bash:  date -u +%Y-%m-%d
  2. Read exports/claim-verify-findings.md IF it exists. APPEND a new section
     "## Run N — paper v${summary.paperVersion} — <date>" (use the next run number if prior runs
     exist; else "Run 1"); do NOT modify any prior content. If the file does not exist, CREATE it
     with a one-line preamble then this run's section.
  3. In the section, write: a summary table of verdict counts (from the summary object) + total
     verified; then grouped subsections, most serious first — Critical / wrong number → Untraceable
     → Unsupported (number mismatch) → Needs paid reproduction → Low confidence. For each flagged
     claim: its §/line, the claim text, claimed-vs-reproduced, the source that was checked, and a
     concrete recommended action in the §G house style ("trace + relabel", "add run_id + judge +
     column", "reproduce with a committed script", or "drop").
  4. Close by noting: (a) any resulting paper edit needs a paper-full-2.0.md version bump +
     revision-history entry (CLAUDE.md), (b) this audit only reports — it must not edit the paper,
     and (c) this run used single-pass verification (no adversarial second opinion) — flagged
     items warrant a manual second look.

Use Write/Edit to save exports/claim-verify-findings.md. Then return a short plain-language summary:
the verdict counts, the count of critical items, the single most important finding, and the report
path. No marketing, no "honest".`;

// ----------------------------------------------------------------------------
// Phase 0 — Scout
// ----------------------------------------------------------------------------
phase('Scout');
const scout = await agent(scoutPrompt(), {
  label: 'scout-structure',
  phase: 'Scout',
  schema: SCOUT_SCHEMA,
  model: 'sonnet',
  effort: 'low',
});
if (!scout || !scout.sections || !scout.sections.length) {
  log('Scout returned no sections — aborting.');
  return { error: 'scout_failed' };
}
const paperVersion = scout.paperVersion || 'unknown';
const totalLines = scout.totalLines || scout.sections[scout.sections.length - 1].startLine + 460;
log(`Paper v${paperVersion}, ${totalLines} lines, ${scout.sections.length} headings.`);

// Build balanced line-range chunks in plain JS (deterministic).
const secs = scout.sections.slice().sort((a, b) => a.startLine - b.startLine);
const bounds = secs.map((s, i) => ({
  start: s.startLine,
  end: i + 1 < secs.length ? secs[i + 1].startLine - 1 : totalLines,
  title: s.title,
}));
let chunks = [];
let cur = null;
for (const b of bounds) {
  if (!cur) cur = { start: b.start, end: b.end, titles: [b.title] };
  else if (b.end - cur.start + 1 <= TARGET_CHUNK_LINES) {
    cur.end = b.end;
    cur.titles.push(b.title);
  } else {
    chunks.push(cur);
    cur = { start: b.start, end: b.end, titles: [b.title] };
  }
}
if (cur) chunks.push(cur);

const plannedChunks = chunks.length;
if (MAX_CHUNKS && MAX_CHUNKS < chunks.length) {
  chunks = chunks.slice(0, MAX_CHUNKS);
  log(
    `SCOPED SMOKE: auditing ${chunks.length} of ${plannedChunks} chunks (maxChunks=${MAX_CHUNKS}). NOT full coverage.`,
  );
} else {
  log(`Planned ${chunks.length} audit chunks (~${TARGET_CHUNK_LINES} lines each).`);
}

// ----------------------------------------------------------------------------
// Phase 1 — Audit: one agent per chunk does extract + verify. Barrier (need all
// verdicts before counting + synthesis). ~10-12 agents total, not ~1000.
// ----------------------------------------------------------------------------
phase('Audit');
const chunkResults = await parallel(
  chunks.map(
    (c, idx) => () =>
      agent(auditPrompt(c, idx, chunks.length), {
        label: `audit:${c.start}-${c.end}`,
        phase: 'Audit',
        schema: CHUNK_FINDINGS_SCHEMA,
        model: 'sonnet',
      }),
  ),
);
const verdicts = chunkResults.filter(Boolean).flatMap((r) => r.claims || []);
log(
  `Audited ${verdicts.length} claims across ${chunks.length} chunks (${chunkResults.filter(Boolean).length} chunks returned).`,
);
if (!verdicts.length) return { paperVersion, totalClaims: 0, note: 'no claims returned' };

// ----------------------------------------------------------------------------
// Phase 2 — Synthesize: counts in JS; the agent writes the report.
// ----------------------------------------------------------------------------
phase('Synthesize');
const counts = {};
for (const v of verdicts) counts[v.verdict] = (counts[v.verdict] || 0) + 1;
const flagged = verdicts.filter((v) => v.verdict !== 'supported');
const criticalCount = verdicts.filter((v) => v.severity === 'critical').length;
log(`Counts: ${JSON.stringify(counts)}. Flagged: ${flagged.length}, critical: ${criticalCount}.`);

const summary = {
  paperVersion,
  paperPath: PAPER,
  scoped: MAX_CHUNKS ? `${chunks.length}/${plannedChunks} chunks (smoke)` : 'full',
  totalClaimsAudited: verdicts.length,
  counts,
  flaggedCount: flagged.length,
  criticalCount,
};
const compact = flagged.map((v) => ({
  section: v.section,
  line: v.line,
  text: (v.text || '').slice(0, 240),
  claimed: v.claimed_value,
  verdict: v.verdict,
  severity: v.severity,
  source: (v.source || '').slice(0, 320),
  reproduced: (v.reproduced_value || '').slice(0, 180),
  discrepancy: (v.discrepancy || '').slice(0, 240),
  evidence: (v.evidence || '').slice(0, 320),
}));

const reportSummary = await agent(synthPrompt(summary, compact), {
  label: 'synthesize-report',
  phase: 'Synthesize',
});

return { ...summary, reportPath: 'exports/claim-verify-findings.md', reportSummary };
