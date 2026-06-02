#!/usr/bin/env node
/**
 * Surface poetics cases where an adaptive branch was generated but the public
 * dialogue or judge scores do not show a reliable adaptive mechanism.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPoeticsStore } from '../services/poeticsStore.js';
import { classifyPoeticsConsensus } from './lib/poeticsConsensus.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_RUN_ID = 'phase2-classic-drama-adaptation-pilot-v1';
const DEFAULT_ARMS = ['peripeteia-only', 'reframe+peripeteia', 'tutor-uptake-only', 'reframe+tutor-uptake'];
const DEFAULT_MIN_TUTOR_MECHANISM = 70;

function parseArgs(argv) {
  const args = {
    runId: DEFAULT_RUN_ID,
    dbPath: null,
    arms: DEFAULT_ARMS,
    out: null,
    json: null,
    limit: 8,
    minTutorMechanism: DEFAULT_MIN_TUTOR_MECHANISM,
    maxPublicChars: 1800,
    maxInnerChars: 2200,
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--run-id') args.runId = argv[++i];
    else if (token === '--db') args.dbPath = path.resolve(argv[++i]);
    else if (token === '--arms') args.arms = splitCsv(argv[++i]);
    else if (token === '--out') args.out = path.resolve(argv[++i]);
    else if (token === '--json') args.json = path.resolve(argv[++i]);
    else if (token === '--limit') args.limit = parseInt(argv[++i], 10);
    else if (token === '--min-tutor-mechanism') args.minTutorMechanism = Number(argv[++i]);
    else if (token === '--max-public-chars') args.maxPublicChars = parseInt(argv[++i], 10);
    else if (token === '--max-inner-chars') args.maxInnerChars = parseInt(argv[++i], 10);
    else if (token === '--help' || token === '-h') {
      console.log(`Usage:
  node scripts/diagnose-poetics-adaptation-failures.js [--run-id RUN_ID]
      [--arms peripeteia-only,tutor-uptake-only] [--limit N]
      [--out report.md] [--json report.json]

Default run: ${DEFAULT_RUN_ID}`);
      process.exit(0);
    } else {
      throw new Error(`unknown arg: ${token}`);
    }
  }
  if (!args.runId) throw new Error('--run-id is required');
  if (!args.arms.length) throw new Error('--arms must include at least one arm');
  if (!Number.isInteger(args.limit) || args.limit < 1) throw new Error('--limit must be a positive integer');
  return args;
}

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function decodeJson(value, fallback = null) {
  if (value == null || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function rel(p) {
  return path.relative(ROOT, path.resolve(p));
}

function absFromRoot(p) {
  if (!p) return null;
  return path.isAbsolute(p) ? p : path.resolve(ROOT, p);
}

function readText(p) {
  const abs = absFromRoot(p);
  if (!abs || !fs.existsSync(abs)) return '';
  return fs.readFileSync(abs, 'utf8');
}

function truncate(text, maxChars) {
  const clean = String(text || '').trim();
  if (!maxChars || clean.length <= maxChars) return clean;
  const cut = clean.slice(0, maxChars);
  const at = Math.max(cut.lastIndexOf('\n\n'), cut.lastIndexOf('\n'), cut.lastIndexOf(' '));
  return `${cut.slice(0, at > maxChars * 0.6 ? at : maxChars).trim()}\n[truncated]`;
}

function stripProvenance(text) {
  return String(text || '')
    .replace(/^_provenance:.*_\n?/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sectionAfter(block, title) {
  const marker = `### ${title}`;
  const start = block.indexOf(marker);
  if (start === -1) return '';
  const afterTitle = block.slice(start + marker.length);
  const next = afterTitle.search(/\n### |\n## /);
  return stripProvenance(next === -1 ? afterTitle : afterTitle.slice(0, next));
}

function importantCritique(text) {
  const paragraphs = String(text || '')
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  const selected = paragraphs.filter((part) =>
    /PERIPETEIA_CHECK|UPTAKE_CHECK|KEEP_OR_CHANGE|main risk|risk|needed mechanism|does not fully register/i.test(part),
  );
  return (selected.length ? selected : paragraphs).slice(0, 3).join('\n\n');
}

function extractTutorInnerFragments(tutorPath, maxChars) {
  const raw = readText(tutorPath);
  if (!raw) return '';
  const blocks = raw
    .split(/\n(?=## Turn \d+ \/ TUTOR)/)
    .map((block) => block.trim())
    .filter((block) => block.startsWith('## Turn'));
  const fragments = [];
  for (const block of blocks) {
    const turn = block.match(/^## Turn ([^/]+) \/ TUTOR/)?.[1]?.trim() || '?';
    const critique = importantCritique(sectionAfter(block, 'Tutor Superego (critique)'));
    const adjudication =
      sectionAfter(block, 'Tutor Ego (adjudication/final authority)').match(/_private decision:[\s\S]*?_/)?.[0] || '';
    const output = sectionAfter(block, 'Tutor Public Output');
    const useful = [critique, adjudication, output].filter(Boolean).join('\n\n');
    if (!useful) continue;
    fragments.push(`Turn ${turn}\n${truncate(useful, Math.max(600, Math.floor(maxChars / 2)))}`);
  }
  return truncate(fragments.slice(-2).join('\n\n---\n\n'), maxChars);
}

function loadRows(db, { runId, arms }) {
  const placeholders = arms.map(() => '?').join(',');
  return db
    .prepare(
      `
      SELECT
        i.id AS item_id,
        i.run_id,
        i.unit_id,
        i.repeat,
        i.arm,
        i.tid,
        i.drama_id,
        i.discipline,
        i.condition_name,
        i.intended_lean,
        i.sample_path,
        i.full_transcript_path,
        i.key_path,
        i.quality_status,
        i.quality_warnings,
        a.learner_self_reframe,
        a.tutor_contingent_adaptation,
        a.tutor_adaptation_score,
        a.tutor_strategy_before,
        a.tutor_strategy_after,
        a.uptake_delta,
        a.evidence AS adaptation_evidence,
        a.metadata AS adaptation_metadata,
        s.critic_model,
        s.score_file,
        s.form_class,
        s.recontextualization,
        s.stated_insight,
        s.rupture,
        s.global_coherence,
        s.pivot_learner_turn,
        s.recohered_earlier,
        s.metadata AS score_metadata
      FROM poetics_items i
      LEFT JOIN poetics_tutor_adaptations a
        ON a.item_id = i.id AND a.analyzer_version = 'tutor-adaptation-v4'
      LEFT JOIN poetics_scores s ON s.item_id = i.id
      WHERE i.run_id = ? AND i.arm IN (${placeholders})
      ORDER BY i.arm, i.drama_id, i.tid, s.critic_model
    `,
    )
    .all(runId, ...arms);
}

function groupCases(rows) {
  const cases = new Map();
  for (const row of rows) {
    if (!cases.has(row.item_id)) {
      cases.set(row.item_id, {
        itemId: row.item_id,
        runId: row.run_id,
        unitId: row.unit_id,
        repeat: row.repeat,
        arm: row.arm,
        tid: row.tid,
        dramaId: row.drama_id,
        discipline: row.discipline,
        conditionName: row.condition_name,
        intendedLean: row.intended_lean,
        samplePath: row.sample_path,
        fullTranscriptPath: row.full_transcript_path,
        tutorPath: row.full_transcript_path ? row.full_transcript_path.replace(/\.full\.md$/, '.tutor.md') : null,
        keyPath: row.key_path,
        qualityStatus: row.quality_status,
        qualityWarnings: decodeJson(row.quality_warnings, []),
        adaptation: {
          learnerSelfReframe: Boolean(row.learner_self_reframe),
          tutorContingentAdaptation: Boolean(row.tutor_contingent_adaptation),
          tutorAdaptationScore: row.tutor_adaptation_score ?? null,
          tutorStrategyBefore: row.tutor_strategy_before,
          tutorStrategyAfter: row.tutor_strategy_after,
          uptakeDelta: row.uptake_delta ?? null,
          evidence: row.adaptation_evidence || '',
          metadata: decodeJson(row.adaptation_metadata, {}) || {},
        },
        scores: [],
      });
    }
    if (row.critic_model) {
      const metadata = decodeJson(row.score_metadata, {}) || {};
      cases.get(row.item_id).scores.push({
        critic: row.critic_model,
        form: row.form_class,
        recontextualization: row.recontextualization,
        statedInsight: row.stated_insight,
        rupture: row.rupture,
        globalCoherence: row.global_coherence,
        pivotLearnerTurn: row.pivot_learner_turn,
        recoheredEarlier: row.recohered_earlier,
        tutorAdaptiveMechanism: metadata.tutor_adaptive_mechanism ?? metadata.tutor_strategic_reversal ?? null,
        tutorContingentAdaptation: metadata.tutor_contingent_adaptation ?? null,
        tutorReversalEvidence: metadata.tutor_reversal_evidence || '',
        tutorReversalJustification: metadata.tutor_reversal_justification || '',
        tutorAdaptationEvidence: metadata.tutor_adaptation_evidence || '',
        tutorAdaptationJustification: metadata.tutor_adaptation_justification || '',
      });
    }
  }
  return [...cases.values()];
}

function mean(values) {
  const xs = values.filter((value) => Number.isFinite(Number(value))).map(Number);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

function classifyCase(c, args) {
  const consensus = classifyPoeticsConsensus(c.scores);
  const peripeteia = c.adaptation.metadata?.peripeteia || {};
  const branchValidity = c.adaptation.metadata?.branch_validity || {};
  const meanTutorMechanism = mean(c.scores.map((score) => score.tutorAdaptiveMechanism));
  const meanTutorUptake = mean(c.scores.map((score) => score.tutorContingentAdaptation));
  const issueTags = [];

  if (c.qualityStatus === 'review_before_scoring' || c.qualityWarnings.length) issueTags.push('quality_gated');
  if (branchValidity.valid === false) issueTags.push('branch_private_event_missing');
  if (consensus.claimStatus !== 'claimable') issueTags.push(`consensus_${consensus.claimStatus}`);
  if (meanTutorMechanism == null || meanTutorMechanism < args.minTutorMechanism)
    issueTags.push('low_judge_tutor_mechanism');
  if (c.arm.includes('peripeteia')) {
    if (peripeteia.learner_reversal_pressure === false) issueTags.push('no_branch_pressure');
    if (peripeteia.instrumented_pressure === false) issueTags.push('no_instrumented_pressure');
    if (!peripeteia.private_mechanism_declared) issueTags.push('no_private_route');
    if (!(peripeteia.tutor_adaptive_mechanism || peripeteia.tutor_strategy_reversal)) {
      issueTags.push('no_public_habit_break');
    }
  }
  if (c.arm.includes('tutor-uptake') && !c.adaptation.tutorContingentAdaptation) issueTags.push('no_contingent_uptake');
  if (c.arm.includes('reframe') && !c.adaptation.learnerSelfReframe) issueTags.push('missing_learner_reframe');

  const severity =
    issueTags.length +
    (issueTags.includes('consensus_negative') ? 3 : 0) +
    (issueTags.includes('consensus_boundary') ? 2 : 0) +
    (issueTags.includes('low_judge_tutor_mechanism') ? 2 : 0) +
    (issueTags.includes('no_public_habit_break') ? 2 : 0) +
    (issueTags.includes('no_private_route') ? 1 : 0);

  return {
    ...c,
    consensus,
    peripeteia,
    branchValidity,
    meanTutorMechanism,
    meanTutorUptake,
    issueTags,
    severity,
  };
}

function buildDiagnosticReport(db, args) {
  const rows = loadRows(db, args);
  const cases = groupCases(rows).map((c) => classifyCase(c, args));
  const candidates = cases
    .filter((c) => c.issueTags.length)
    .sort((a, b) => b.severity - a.severity || a.arm.localeCompare(b.arm) || a.tid.localeCompare(b.tid))
    .slice(0, args.limit)
    .map((c) => ({
      ...c,
      publicFragment: truncate(readText(c.samplePath), args.maxPublicChars),
      tutorInnerFragment: extractTutorInnerFragments(c.tutorPath, args.maxInnerChars),
    }));

  return {
    generatedAt: new Date().toISOString(),
    runId: args.runId,
    arms: args.arms,
    thresholds: { minTutorMechanism: args.minTutorMechanism },
    totalCases: cases.length,
    failureCandidates: candidates.length,
    cases: candidates,
  };
}

function fmt(value, digits = 1) {
  return value == null || Number.isNaN(Number(value)) ? 'n/a' : Number(value).toFixed(digits);
}

function votesText(consensus) {
  return (consensus.votes || []).map((vote) => `${vote.critic}=${vote.form}`).join(', ') || 'no scores';
}

function renderMarkdown(report) {
  const lines = [
    '# Poetics Adaptation Failure Diagnostics',
    '',
    `Generated: ${report.generatedAt}`,
    `Run: \`${report.runId}\``,
    `Arms: ${report.arms.map((arm) => `\`${arm}\``).join(', ')}`,
    `Cases scanned: ${report.totalCases}; candidates shown: ${report.failureCandidates}`,
    '',
  ];

  for (const c of report.cases) {
    lines.push(
      `## ${c.tid} / ${c.dramaId} / ${c.arm}`,
      '',
      `Item: \`${c.itemId}\``,
      `Issues: ${c.issueTags.map((tag) => `\`${tag}\``).join(', ')}`,
      `Consensus: \`${c.consensus.claimStatus}\` (${c.consensus.recognitionVotes}/${c.consensus.totalCritics} recognition)`,
      `Votes: ${votesText(c.consensus)}`,
      `Mean judge tutor mechanism: ${fmt(c.meanTutorMechanism)}; mean judge tutor uptake: ${fmt(c.meanTutorUptake)}`,
      `Branch validity: valid=${c.branchValidity.valid ?? 'n/a'}; learnerReversalEventUsed=${c.branchValidity.learner_reversal_event_used ?? 'n/a'}; learnerReframeEventUsed=${c.branchValidity.learner_reframe_event_used ?? 'n/a'}`,
      `Analyzer: learnerPressure=${Boolean(c.peripeteia.learner_reversal_pressure)}; instrumentedPressure=${Boolean(c.peripeteia.instrumented_pressure)}; privateRoute=${Boolean(c.peripeteia.private_mechanism_declared)}; publicHabitBreak=${Boolean(c.peripeteia.tutor_adaptive_mechanism || c.peripeteia.tutor_strategy_reversal)}; tutorPeripeteia=${fmt(c.peripeteia.tutor_peripeteia_score)}`,
      `Artifacts: [public](${rel(c.samplePath)}) / [tutor inner](${rel(c.tutorPath || '')})`,
      '',
      '### Public Fragment',
      '',
      '```text',
      c.publicFragment || '[missing public transcript]',
      '```',
      '',
      '### Tutor Inner Fragment',
      '',
      '```text',
      c.tutorInnerFragment || '[missing tutor transcript]',
      '```',
      '',
      '### Judge Mechanism Evidence',
      '',
    );
    for (const score of c.scores) {
      lines.push(
        `- ${score.critic}: form=${score.form}; tutorMechanism=${fmt(score.tutorAdaptiveMechanism)}; uptake=${fmt(score.tutorContingentAdaptation)}; evidence=${truncate(score.tutorReversalEvidence || score.tutorAdaptationEvidence || '', 260).replace(/\n/g, ' ') || '[none]'}`,
      );
    }
    lines.push('');
  }
  return lines.join('\n');
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function runCli(args) {
  const db = openPoeticsStore(args.dbPath || undefined);
  try {
    const report = buildDiagnosticReport(db, args);
    const markdown = renderMarkdown(report);
    if (args.out) writeFile(args.out, `${markdown}\n`);
    if (args.json) writeFile(args.json, `${JSON.stringify(report, null, 2)}\n`);
    if (!args.out) console.log(markdown);
    else console.log(`wrote adaptation diagnostics: ${rel(args.out)}`);
    if (args.json) console.log(`json: ${rel(args.json)}`);
  } finally {
    db.close();
  }
}

if (path.resolve(process.argv[1] || '') === __filename) {
  try {
    runCli(parseArgs(process.argv.slice(2)));
  } catch (err) {
    console.error(err?.stack || String(err));
    process.exit(1);
  }
}

export { buildDiagnosticReport, classifyCase, parseArgs, renderMarkdown };
