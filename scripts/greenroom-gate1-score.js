#!/usr/bin/env node
/**
 * Gate 1 uptake scorer (GREEN-ROOM-PLAN.md §7 / §7.2).
 *
 * For every bankable note issued during the training arc, judge binary
 * compliance in each performance's transcript (haiku judge, quote required),
 * split pre/post around the note's issuing session, and report the fraction
 * of notes whose compliance improved. Never-issued placebo notes are scored
 * identically (notional issue point = median session index) as the base-rate
 * drift control.
 *
 * Usage:
 *   node scripts/greenroom-gate1-score.js \
 *     --gate-dir exports/greenroom-gate1-2026-07-12 \
 *     --profile marrick-ps-a \
 *     --order P1,P2,P3,P4,P5,P6,P7,P8 \
 *     [--placebo <notes.json>] [--judge claude-code.haiku] [--dry-run]
 *
 * Conventions: performances/<label>.json (stub saves) + rendered
 * transcripts/<label>.md; coach sessions in the profile dir carry
 * `label` = the performance they coached (P1..P6).
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { loadProfile } from '../services/greenroom/store.js';
import { callAIWithCliBridge } from '../services/cliProviderBridge.js';
import { renderStubRun } from './greenroom-render-transcript.js';

function getOption(args, name, fallback = null) {
  const idx = args.indexOf(name);
  return idx !== -1 && idx < args.length - 1 ? args[idx + 1] : fallback;
}

function parseModelRef(ref) {
  const dot = ref.indexOf('.');
  return { provider: ref.slice(0, dot), model: ref.slice(dot + 1) };
}

export function collectNotes(profileDir, order) {
  const sessionsDir = path.join(profileDir, 'sessions');
  const notes = [];
  if (!fs.existsSync(sessionsDir)) return notes;
  for (const file of fs
    .readdirSync(sessionsDir)
    .filter((f) => f.endsWith('.json'))
    .sort()) {
    const record = JSON.parse(fs.readFileSync(path.join(sessionsDir, file), 'utf8'));
    const label = record.label || null;
    const issueIdx = order.indexOf(label);
    for (const [i, note] of (record.structured?.notes || []).entries()) {
      notes.push({
        id: `${file.replace('-notes.json', '')}.${i + 1}`,
        session_file: file,
        issued_after: label,
        issue_index: issueIdx, // performances with order index <= issue_index are PRE
        note: note.note,
        check: note.check,
        evidence_quote: note.evidence_quote || null,
      });
    }
  }
  return notes;
}

function judgePrompt(transcript, notes) {
  return `You are a compliance auditor for tutoring craft notes. For EACH note below,
decide whether this transcript COMPLIES with the note's behavioural predicate.
Judge the tutor's behaviour only. If the situation the note targets never
arises in the transcript, count it as "n/a" (not compliance, not violation).

Notes:
${notes.map((n, i) => `${i + 1}. [${n.id}] ${n.note}\n   Verification: ${n.check}`).join('\n')}

Transcript:
---
${transcript}
---

Reply with ONLY a fenced json block:
\`\`\`json
{ "verdicts": [ { "id": "<note id>", "verdict": "complies" | "violates" | "n/a", "evidence": "<short quote>" } ] }
\`\`\``;
}

function parseVerdicts(text) {
  const fences = [...String(text).matchAll(/```json\s*([\s\S]*?)```/g)];
  for (let i = fences.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(fences[i][1].replace(/,\s*([}\]])/g, '$1'));
    } catch {
      /* try earlier */
    }
  }
  return null;
}

export function summarize(notes, verdictsByPerf, order) {
  const rows = [];
  for (const note of notes) {
    const pre = [];
    const post = [];
    for (const [perfIdx, label] of order.entries()) {
      const v = verdictsByPerf[label]?.[note.id];
      if (!v || v === 'n/a') continue;
      const complies = v === 'complies' ? 1 : 0;
      if (note.issue_index === -1 || perfIdx <= note.issue_index) pre.push(complies);
      else post.push(complies);
    }
    const rate = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
    const preRate = rate(pre);
    const postRate = rate(post);
    rows.push({
      ...note,
      pre_n: pre.length,
      post_n: post.length,
      pre_rate: preRate,
      post_rate: postRate,
      improved: preRate !== null && postRate !== null ? postRate > preRate : null,
    });
  }
  return rows;
}

async function main() {
  const args = process.argv.slice(2);
  const gateDir = path.resolve(getOption(args, '--gate-dir'));
  const profileId = getOption(args, '--profile');
  const order = String(getOption(args, '--order', ''))
    .split(',')
    .filter(Boolean);
  const judgeRef = parseModelRef(getOption(args, '--judge', 'claude-code.haiku'));
  const placeboPath = getOption(args, '--placebo');
  const dryRun = args.includes('--dry-run');
  if (!gateDir || !profileId || order.length === 0) {
    console.error('usage: see file header (--gate-dir, --profile, --order required)');
    process.exit(1);
  }

  const profile = loadProfile(profileId);
  const notes = collectNotes(profile.dir, order);
  const medianIssue = Math.floor((order.length - 1) / 2);
  if (placeboPath) {
    const placebo = JSON.parse(fs.readFileSync(placeboPath, 'utf8'));
    for (const [i, p] of placebo.entries()) {
      notes.push({
        id: `placebo.${i + 1}`,
        session_file: null,
        issued_after: 'PLACEBO',
        issue_index: medianIssue,
        note: p.note,
        check: p.check,
        placebo: true,
      });
    }
  }
  console.log(
    `gate1-score: ${notes.length} notes (${notes.filter((n) => n.placebo).length} placebo) × ${order.length} performances`,
  );

  const transcripts = {};
  for (const label of order) {
    const runPath = path.join(gateDir, 'performances', `${label}.json`);
    transcripts[label] = renderStubRun(JSON.parse(fs.readFileSync(runPath, 'utf8')), label);
  }

  const verdictsByPerf = {};
  const rawByPerf = {};
  for (const label of order) {
    verdictsByPerf[label] = {};
    rawByPerf[label] = [];
    // chunk notes 3 at a time to keep each judging call focused
    for (let i = 0; i < notes.length; i += 3) {
      const chunk = notes.slice(i, i + 3);
      const prompt = judgePrompt(transcripts[label], chunk);
      if (dryRun) {
        for (const n of chunk) verdictsByPerf[label][n.id] = 'n/a';
        continue;
      }
      const result = await callAIWithCliBridge(
        { provider: judgeRef.provider, model: judgeRef.model },
        'You audit transcripts against behavioural predicates. You are strict about evidence and never infer beyond the text.',
        prompt,
        `gate1:judge:${label}:${i}`,
      );
      const parsed = parseVerdicts(result.text);
      rawByPerf[label].push({ chunk: chunk.map((n) => n.id), text: result.text });
      for (const n of chunk) {
        const v = parsed?.verdicts?.find((x) => x.id === n.id);
        verdictsByPerf[label][n.id] = v?.verdict || 'n/a';
      }
      process.stdout.write(`  ${label}: ${Math.min(i + 3, notes.length)}/${notes.length}\r`);
    }
    console.log(`  ${label}: done                    `);
  }

  const rows = summarize(notes, verdictsByPerf, order);
  const real = rows.filter((r) => !r.placebo && r.improved !== null);
  const improved = real.filter((r) => r.improved).length;
  const placeboRows = rows.filter((r) => r.placebo && r.improved !== null);
  const placeboImproved = placeboRows.filter((r) => r.improved).length;
  const uptake = real.length ? improved / real.length : null;
  const placeboRate = placeboRows.length ? placeboImproved / placeboRows.length : null;
  const pass = uptake !== null && uptake >= 0.6 && (placeboRate === null || uptake > placeboRate);

  const report = {
    gate: 'greenroom-gate1',
    scoredAt: new Date().toISOString(),
    order,
    judge: `${judgeRef.provider}.${judgeRef.model}`,
    notes: rows,
    verdicts: verdictsByPerf,
    summary: {
      scoreable_notes: real.length,
      improved,
      uptake_rate: uptake,
      placebo_notes: placeboRows.length,
      placebo_improved: placeboImproved,
      placebo_rate: placeboRate,
      bar: 0.6,
      pass,
    },
  };
  fs.writeFileSync(path.join(gateDir, 'gate1-report.json'), JSON.stringify(report, null, 2));
  const md = [
    '# Gate 1 — note-uptake report',
    '',
    `Judge: ${report.judge} · Performances: ${order.join(', ')}`,
    '',
    `**Uptake: ${improved}/${real.length} notes improved (${uptake === null ? 'n/a' : (uptake * 100).toFixed(0)}%) · bar 60% · placebo ${placeboRate === null ? 'n/a' : (placeboRate * 100).toFixed(0)}% · ${pass ? 'PASS' : 'FAIL'}**`,
    '',
    '| note | issued after | pre rate (n) | post rate (n) | improved |',
    '|---|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${r.id}${r.placebo ? ' (placebo)' : ''} | ${r.issued_after} | ${r.pre_rate === null ? '—' : r.pre_rate.toFixed(2)} (${r.pre_n}) | ${r.post_rate === null ? '—' : r.post_rate.toFixed(2)} (${r.post_n}) | ${r.improved === null ? '—' : r.improved ? 'yes' : 'no'} |`,
    ),
    '',
    'Note texts and judging raw output: gate1-report.json.',
  ].join('\n');
  fs.writeFileSync(path.join(gateDir, 'gate1-report.md'), md);
  console.log(`\n${md.split('\n').slice(0, 8).join('\n')}\n→ ${path.join(gateDir, 'gate1-report.{json,md}')}`);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
