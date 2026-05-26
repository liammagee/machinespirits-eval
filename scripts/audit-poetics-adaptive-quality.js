#!/usr/bin/env node
/**
 * Deterministic audit for adaptive-mechanism quality.
 *
 * This does not adjudicate with another model. It surfaces the public sample,
 * critic scores, evidence quotes, and scorer flags for cases where the tutor
 * mechanism exists but the external quality axis is weak or contested.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPoeticsStore } from '../services/poeticsStore.js';
import { classifyPoeticsConsensus } from './lib/poeticsConsensus.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

function parseArgs(argv) {
  const args = {
    dbPath: null,
    runId: 'phase2-compact-anchor-adaptation-v1',
    arm: null,
    out: path.join(ROOT, 'exports', 'poetics-adaptive-quality-audit.md'),
    all: false,
    threshold: 75,
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--db') args.dbPath = path.resolve(argv[++i]);
    else if (token === '--run-id') args.runId = argv[++i];
    else if (token === '--arm') args.arm = argv[++i];
    else if (token === '--out') args.out = path.resolve(argv[++i]);
    else if (token === '--all') args.all = true;
    else if (token === '--threshold') args.threshold = Number(argv[++i]);
    else if (token === '--help' || token === '-h') {
      console.log(`Usage:
  node scripts/audit-poetics-adaptive-quality.js --run-id ID
      [--arm peripeteia-only] [--out audit.md] [--all] [--threshold 75]`);
      process.exit(0);
    } else {
      throw new Error(`unknown arg: ${token}`);
    }
  }
  return args;
}

function decodeJson(value, fallback = {}) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function resolveArtifact(relPath) {
  if (!relPath) return null;
  const abs = path.resolve(ROOT, relPath);
  if (!abs.startsWith(`${ROOT}${path.sep}`)) throw new Error(`artifact escapes repo root: ${relPath}`);
  return abs;
}

function readText(relPath, maxChars = 3600) {
  const abs = resolveArtifact(relPath);
  if (!abs || !fs.existsSync(abs)) return '';
  const text = fs.readFileSync(abs, 'utf8');
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n\n[truncated]` : text;
}

function scoreFromMetadata(metadata, key, roleKey) {
  return metadata?.[key] ?? metadata?.role_symmetric_scores?.[roleKey]?.score100 ?? null;
}

function loadQualityAuditRows(db, { runId, arm = null, threshold = 75, all = false } = {}) {
  const params = { runId };
  const where = ['i.run_id = @runId'];
  if (arm) {
    where.push('i.arm = @arm');
    params.arm = arm;
  }
  const rows = db
    .prepare(
      `
      SELECT
        i.id AS item_id,
        i.run_id,
        i.repeat,
        i.unit_id,
        i.arm,
        i.tid,
        i.drama_id,
        i.sample_path,
        i.full_transcript_path,
        s.critic_model,
        s.form_class,
        s.recontextualization,
        s.stated_insight,
        s.metadata AS score_metadata
      FROM poetics_items i
      JOIN poetics_scores s ON s.item_id = i.id
      WHERE ${where.join(' AND ')}
      ORDER BY i.repeat, i.unit_id, i.arm, i.tid, s.critic_model
    `,
    )
    .all(params)
    .map((row) => {
      const metadata = decodeJson(row.score_metadata, {});
      const roleScores = metadata.role_symmetric_scores || {};
      const mechanism = roleScores.tutor_adaptive_mechanism || roleScores.tutor_strategy_reversal || {};
      const quality = roleScores.tutor_adaptive_mechanism_quality || {};
      return {
        ...row,
        metadata,
        mechanismScore: scoreFromMetadata(metadata, 'tutor_adaptive_mechanism', 'tutor_adaptive_mechanism'),
        qualityScore: scoreFromMetadata(metadata, 'adaptive_mechanism_quality', 'tutor_adaptive_mechanism_quality'),
        actionalScore: scoreFromMetadata(metadata, 'actional_breakthrough', 'learner_actional_breakthrough'),
        mechanismEvidence: mechanism.evidence || metadata.tutor_reversal_evidence || '',
        qualityEvidence: quality.evidence || metadata.adaptive_mechanism_quality_evidence || '',
        qualityJustification: quality.justification || metadata.adaptive_mechanism_quality_justification || '',
        flags: metadata.flags || [],
      };
    });

  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.item_id)) grouped.set(row.item_id, []);
    grouped.get(row.item_id).push(row);
  }

  return [...grouped.values()]
    .map((scores) => {
      const first = scores[0];
      const mechanismHits = scores.filter((score) => Number(score.mechanismScore || 0) >= threshold).length;
      const qualityHits = scores.filter((score) => Number(score.qualityScore || 0) >= threshold).length;
      const clamped = scores.filter((score) =>
        (score.flags || []).some((flag) => String(flag).startsWith('adaptive_mechanism_quality')),
      ).length;
      return {
        item: first,
        consensus: classifyPoeticsConsensus(scores.map((row) => ({ critic: row.critic_model, form: row.form_class }))),
        mechanismHits,
        qualityHits,
        clamped,
        scores,
        publicText: readText(first.sample_path),
        fullTranscriptPreview: readText(first.full_transcript_path, 2200),
      };
    })
    .filter((entry) => all || entry.mechanismHits > entry.qualityHits || entry.clamped > 0)
    .sort((a, b) => {
      const gapA = a.mechanismHits - a.qualityHits;
      const gapB = b.mechanismHits - b.qualityHits;
      return gapB - gapA || a.item.item_id.localeCompare(b.item.item_id);
    });
}

function renderQualityAuditMarkdown({ runId, arm, threshold, audits }) {
  const lines = [
    '# Poetics Adaptive Mechanism Quality Audit',
    '',
    `Run: \`${runId}\``,
    '',
    `Arm: \`${arm || 'all'}\``,
    '',
    `Threshold: ${threshold}`,
    '',
    `Cases: ${audits.length}`,
    '',
    '## Reading',
    '',
    'This is not a new judgement. It surfaces cases where critics or gates see a tutor mechanism but not a high-quality public device. Use it to inspect whether the issue is public speech, scorer evidence selection, or model variance.',
    '',
  ];

  for (const audit of audits) {
    const item = audit.item;
    lines.push(
      `## ${item.repeat || 'n/a'} ${item.drama_id || item.tid} ${item.unit_id}${item.arm ? `/${item.arm}` : ''}`,
      '',
      `Item: \`${item.item_id}\``,
      '',
      `Sample: \`${item.sample_path}\``,
      '',
      `Consensus: **${audit.consensus.claimStatus}** / ${audit.consensus.consensusClass} (${audit.consensus.recognitionVotes}/${audit.consensus.totalCritics} recognition votes; disagreement=${audit.consensus.disagreement})`,
      '',
      `Mechanism hits: ${audit.mechanismHits}/${audit.scores.length} · quality hits: ${audit.qualityHits}/${audit.scores.length} · quality clamps: ${audit.clamped}/${audit.scores.length}`,
      '',
      '| Critic | Form | Action | Mechanism | Quality | Flags | Evidence |',
      '|---|---|---:|---:|---:|---|---|',
    );
    for (const score of audit.scores) {
      const evidence = [
        score.mechanismEvidence ? `mechanism: ${score.mechanismEvidence}` : '',
        score.qualityEvidence ? `quality: ${score.qualityEvidence}` : '',
        score.qualityJustification ? `why: ${score.qualityJustification}` : '',
      ]
        .filter(Boolean)
        .join(' / ')
        .replace(/\n/g, ' ');
      const flags = (score.flags || []).filter((flag) => String(flag).includes('mechanism')).join('<br>');
      lines.push(
        `| ${score.critic_model} | ${score.form_class} | ${score.actionalScore ?? ''} | ${score.mechanismScore ?? ''} | ${score.qualityScore ?? ''} | ${flags} | ${evidence} |`,
      );
    }
    lines.push('', '### Public Sample', '', '```text', audit.publicText.trim(), '```', '');
    if (audit.fullTranscriptPreview.trim()) {
      lines.push('### Full Transcript Preview', '', '```markdown', audit.fullTranscriptPreview.trim(), '```', '');
    }
  }
  return `${lines.join('\n')}\n`;
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = openPoeticsStore(args.dbPath || undefined);
  try {
    const audits = loadQualityAuditRows(db, args);
    writeFile(args.out, renderQualityAuditMarkdown({ ...args, audits }));
    console.log(`wrote ${audits.length} adaptive-quality audit case(s) -> ${path.relative(ROOT, args.out)}`);
  } finally {
    db.close();
  }
}

if (path.resolve(process.argv[1] || '') === __filename) {
  try {
    main();
  } catch (err) {
    console.error(err?.stack || String(err));
    process.exit(1);
  }
}

export { loadQualityAuditRows, renderQualityAuditMarkdown };
