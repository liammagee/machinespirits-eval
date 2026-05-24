#!/usr/bin/env node
/**
 * Qualitative audit for poetics critic disagreements.
 *
 * This is deterministic: it does not call a model. It surfaces public text and
 * each critic's evidence fields so boundary cases can be inspected without
 * opening score JSON one by one.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPoeticsStore } from '../services/poeticsStore.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

function parseArgs(argv) {
  const args = {
    dbPath: null,
    runId: 'phase2-hard-trap-controls-v1',
    critic: 'deepseek/deepseek-v4-pro',
    out: path.join(ROOT, 'exports', 'poetics-deepseek-r02-audit.md'),
    onlyDisagreements: true,
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--db') args.dbPath = path.resolve(argv[++i]);
    else if (token === '--run-id') args.runId = argv[++i];
    else if (token === '--critic') args.critic = argv[++i];
    else if (token === '--out') args.out = path.resolve(argv[++i]);
    else if (token === '--all') args.onlyDisagreements = false;
    else if (token === '--help' || token === '-h') {
      console.log(`Usage:
  node scripts/audit-poetics-disagreements.js [--run-id ID]
      [--critic deepseek/deepseek-v4-pro] [--out audit.md] [--all]`);
      process.exit(0);
    } else {
      throw new Error(`unknown arg: ${token}`);
    }
  }
  return args;
}

function resolveArtifact(relPath) {
  if (!relPath) return null;
  const abs = path.resolve(ROOT, relPath);
  if (!abs.startsWith(`${ROOT}${path.sep}`)) throw new Error(`artifact escapes repo root: ${relPath}`);
  return abs;
}

function readText(relPath, maxChars = 4500) {
  const abs = resolveArtifact(relPath);
  if (!abs || !fs.existsSync(abs)) return '';
  const text = fs.readFileSync(abs, 'utf8');
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n\n[truncated]` : text;
}

function loadAuditRows(db, { runId, critic, onlyDisagreements }) {
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
        i.control_family,
        i.control_role,
        i.sample_path,
        i.full_transcript_path,
        s.critic_model,
        s.form_class,
        s.recontextualization,
        s.stated_insight,
        s.rupture,
        s.global_coherence,
        s.pivot_learner_turn,
        s.recohered_earlier,
        s.stated_insight_evidence,
        s.score_file
      FROM poetics_items i
      JOIN poetics_scores s ON s.item_id = i.id
      WHERE i.run_id = ?
      ORDER BY i.repeat, i.unit_id, i.arm, i.tid, s.critic_model
    `,
    )
    .all(runId);

  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.item_id)) grouped.set(row.item_id, []);
    grouped.get(row.item_id).push(row);
  }

  const audits = [];
  for (const itemRows of grouped.values()) {
    const forms = new Set(itemRows.map((row) => row.form_class));
    const focal = itemRows.find((row) => row.critic_model === critic);
    if (!focal) continue;
    if (onlyDisagreements && forms.size <= 1) continue;
    audits.push({
      item: focal,
      scores: itemRows.map((row) => ({
        critic: row.critic_model,
        form: row.form_class,
        recontextualization: row.recontextualization,
        statedInsight: row.stated_insight,
        pivotLearnerTurn: row.pivot_learner_turn,
        recoheredEarlier: row.recohered_earlier,
        statedInsightEvidence: row.stated_insight_evidence,
        scoreFile: row.score_file,
      })),
      publicText: readText(focal.sample_path),
      fullTranscriptPreview: readText(focal.full_transcript_path, 2400),
    });
  }
  return audits;
}

function renderAuditMarkdown({ runId, critic, audits }) {
  const lines = [
    `# Poetics Disagreement Audit`,
    '',
    `Run: \`${runId}\``,
    '',
    `Focal critic: \`${critic}\``,
    '',
    `Cases: ${audits.length}`,
    '',
    '## Reading',
    '',
    'These are not adjudicated ground truth. They are boundary specimens where the critic panel disagrees on whether the public transcript contains actual recontextualization or only insight-costume language.',
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
      '| Critic | Form | Recontextualization | Stated insight | Pivot | Evidence |',
      '|---|---|---:|---:|---:|---|',
    );
    for (const score of audit.scores) {
      const evidence = [score.recoheredEarlier, score.statedInsightEvidence].filter(Boolean).join(' / ');
      lines.push(
        `| ${score.critic} | ${score.form} | ${score.recontextualization ?? ''} | ${score.statedInsight ?? ''} | ${score.pivotLearnerTurn ?? ''} | ${evidence.replace(/\n/g, ' ')} |`,
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
    const audits = loadAuditRows(db, args);
    writeFile(args.out, renderAuditMarkdown({ ...args, audits }));
    console.log(`wrote ${audits.length} audit case(s) -> ${path.relative(ROOT, args.out)}`);
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

export { loadAuditRows, renderAuditMarkdown };
