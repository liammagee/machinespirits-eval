#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { unifiedAIProvider } from '../tutor-core/index.js';
import { resolveModel } from '../services/evalConfigLoader.js';
import { selectAuthoritativeTraces } from './analyze-program2-floor-ablation-mediation.mjs';
import {
  semanticUnitId,
  WEIGHTS_INTERFACE_ANALYSIS_SPEC,
} from './analyze-program2-weights-interface-factorial.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const DEFAULT_JUDGES = Object.freeze(['claude-code.sonnet-5', 'codex.gpt-5.6-terra']);

const SYSTEM_PROMPT = `You are a condition-blind research judge. Score each candidate independently.

A candidate is VALID only when it makes a bounded move that asks the learner to connect already-public evidence to an inference, licensing rule, or missing warrant. It need not use any particular cue word. It is INVALID if it merely asks for recall, requests another clue, states the answer, introduces a new premise, asks an unbounded generic question, or does not ask the learner to connect public evidence to a warranted inference.

Return strict JSON only: {"judgments":[{"unit_id":"...","verdict":"valid|invalid","reason":"one concise sentence"}]}. Return exactly one judgment for every unit_id and no other keys.`;

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function parseJson(text) {
  const source = String(text || '').trim();
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/iu)?.[1] || source;
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('judge returned no JSON object');
  return JSON.parse(fenced.slice(start, end + 1));
}

function publicHistoryBefore(turnRecords, turn) {
  return turnRecords
    .filter((record) => Number(record.turn) < turn)
    .map((record) => ({ turn: Number(record.turn), learner: record.learner || '', tutor: record.tutor || '' }));
}

export function buildBlindSemanticPackets(root) {
  const selection = selectAuthoritativeTraces(root);
  const packets = [];
  const unitIndex = {};
  for (const selected of selection.jobs.filter((entry) => entry.authoritative)) {
    const turnRecords = selected.authoritative.events
      .filter((event) => event.type === 'turn_complete' && event.turnRecord)
      .map((event) => event.turnRecord)
      .sort((a, b) => Number(a.turn) - Number(b.turn));
    const records = [];
    for (const event of selected.authoritative.events) {
      if (event.type !== 'program2_committee_moment' || event.moment?.trigger !== 'warrant_skip') continue;
      const turn = Number(event.turn ?? event.moment.turn);
      const finalText = String(turnRecords.find((record) => Number(record.turn) === turn)?.tutor || '').trim();
      const candidates = [
        { surface: 'raw_mini', text: String(event.moment.miniText || '').trim() },
        { surface: 'final', text: finalText },
      ]
        .filter((candidate) => candidate.text)
        .map((candidate) => {
          const unitId = semanticUnitId({ jobId: selected.job.id, turn, surface: candidate.surface, text: candidate.text });
          unitIndex[unitId] = {
            jobId: selected.job.id,
            turn,
            surface: candidate.surface,
            textSha256: sha256(candidate.text),
          };
          return { unit_id: unitId, candidate: candidate.text };
        });
      // Surface order is blinded and stable without exposing the source label.
      candidates.sort((left, right) => sha256(left.unit_id).localeCompare(sha256(right.unit_id)));
      records.push({
        case_id: `case-${sha256(`${selected.job.id}:${turn}`).slice(0, 16)}`,
        public_history: publicHistoryBefore(turnRecords, turn),
        candidates,
      });
    }
    packets.push({
      packet_id: `packet-${sha256(selected.job.id).slice(0, 16)}`,
      cases: records,
    });
  }
  packets.sort((left, right) => sha256(left.packet_id).localeCompare(sha256(right.packet_id)));
  return {
    schema: 'machinespirits.program2.weights-interface-semantic-blind-packets.v1',
    generatedAt: new Date().toISOString(),
    root,
    blinding: {
      excluded: ['job_id', 'condition', 'weight', 'span_interface', 'model', 'fallback', 'surface_label'],
      includes: ['public_history', 'candidate_text', 'opaque_unit_id'],
    },
    packets,
    unitIndex,
  };
}

function promptForPacket(packet) {
  return [
    'Score every opaque candidate below under the semantic warrant-validity rule in the system instruction.',
    'The candidate order and IDs carry no condition or source information. Use only public_history and candidate.',
    JSON.stringify(packet),
  ].join('\n\n');
}

async function callJudge(judge, packet) {
  const resolved = resolveModel(judge);
  if (!resolved.isConfigured) throw new Error(`${judge} is not configured`);
  const prompt = promptForPacket(packet);
  const response = await unifiedAIProvider.call({
    provider: resolved.provider,
    model: resolved.model,
    systemPrompt: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
    config: { temperature: 0, maxTokens: 4096 },
  });
  const text = response.content ?? response.text ?? '';
  const parsed = parseJson(text);
  const expected = new Set(packet.cases.flatMap((entry) => entry.candidates.map((candidate) => candidate.unit_id)));
  const judgments = Array.isArray(parsed.judgments) ? parsed.judgments : [];
  if (judgments.length !== expected.size) {
    throw new Error(`${judge}/${packet.packet_id}: expected ${expected.size} judgments, received ${judgments.length}`);
  }
  for (const row of judgments) {
    if (!expected.has(row.unit_id)) throw new Error(`${judge}/${packet.packet_id}: unknown unit ${row.unit_id}`);
    if (!['valid', 'invalid'].includes(row.verdict)) {
      throw new Error(`${judge}/${packet.packet_id}: invalid verdict ${row.verdict}`);
    }
  }
  return {
    judgments: judgments.map((row) => ({
      unitId: row.unit_id,
      judge,
      verdict: row.verdict,
      reason: String(row.reason || '').trim(),
      packetId: packet.packet_id,
    })),
    audit: {
      judge,
      provider: resolved.provider,
      model: resolved.model,
      packetId: packet.packet_id,
      promptSha256: sha256(prompt),
      responseSha256: sha256(text),
      latencyMs: response.latencyMs ?? null,
      usage: response.usage || null,
    },
  };
}

export function buildHumanAdjudicationPacket(blindPackets, judgments) {
  const byUnit = new Map();
  for (const row of judgments) {
    const rows = byUnit.get(row.unitId) || [];
    rows.push(row);
    byUnit.set(row.unitId, rows);
  }
  const disagreements = new Set(
    [...byUnit.entries()]
      .filter(([, rows]) => new Set(rows.map((row) => row.verdict)).size > 1)
      .map(([unitId]) => unitId),
  );
  return {
    schema: 'machinespirits.program2.weights-interface-human-adjudication-packet.v1',
    generatedAt: new Date().toISOString(),
    instructions:
      'Condition-blind human: assign valid or invalid using the frozen semantic rule. Add adjudications to semantic-judgments.json; do not inspect unitIndex until labels are sealed.',
    cases: blindPackets.packets.flatMap((packet) =>
      packet.cases
        .map((entry) => ({
          ...entry,
          candidates: entry.candidates.filter((candidate) => disagreements.has(candidate.unit_id)),
          judge_votes: entry.candidates
            .filter((candidate) => disagreements.has(candidate.unit_id))
            .map((candidate) => ({
              unit_id: candidate.unit_id,
              votes: byUnit.get(candidate.unit_id).map((row) => ({ verdict: row.verdict, reason: row.reason })),
            })),
        }))
        .filter((entry) => entry.candidates.length),
    ),
  };
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: 'string' },
      packet: { type: 'string' },
      adjudication: { type: 'string' },
      judges: { type: 'string', default: DEFAULT_JUDGES.join(',') },
      'dry-run': { type: 'boolean', default: false },
    },
  });
  const root = path.resolve(positionals[0] || path.join(REPO_ROOT, 'exports/program2-weights-interface-factorial'));
  const out = path.resolve(values.out || path.join(root, 'semantic-judgments.json'));
  const packetPath = path.resolve(values.packet || path.join(root, 'semantic-blind-packets.json'));
  const adjudicationPath = path.resolve(values.adjudication || path.join(root, 'semantic-human-adjudication.json'));
  const blindPackets = buildBlindSemanticPackets(root);
  fs.writeFileSync(packetPath, `${JSON.stringify(blindPackets, null, 2)}\n`);
  if (values['dry-run']) {
    console.log(`[semantic-judge] dry run: ${blindPackets.packets.length} dialogue packets; 0 model calls`);
    console.log(`[semantic-judge] wrote ${packetPath}`);
    return;
  }
  const judges = values.judges.split(',').map((value) => value.trim()).filter(Boolean);
  if (judges.length !== 2) throw new Error('the frozen instrument requires exactly two judges');
  const existing = fs.existsSync(out)
    ? JSON.parse(fs.readFileSync(out, 'utf8'))
    : { schema: WEIGHTS_INTERFACE_ANALYSIS_SPEC.semanticSchema, judgments: [], adjudications: [], audits: [] };
  for (const packet of blindPackets.packets) {
    for (const judge of judges) {
      const expected = packet.cases.flatMap((entry) => entry.candidates.map((candidate) => candidate.unit_id));
      if (expected.every((unitId) => existing.judgments.some((row) => row.unitId === unitId && row.judge === judge))) {
        console.log(`[semantic-judge] ${packet.packet_id} ${judge} already complete — skipping`);
        continue;
      }
      const result = await callJudge(judge, packet);
      existing.judgments = existing.judgments.filter(
        (row) => !(row.judge === judge && expected.includes(row.unitId)),
      );
      existing.judgments.push(...result.judgments);
      existing.audits.push(result.audit);
      existing.generatedAt = new Date().toISOString();
      existing.judges = judges;
      existing.packetSha256 = sha256(JSON.stringify(blindPackets.packets));
      fs.writeFileSync(out, `${JSON.stringify(existing, null, 2)}\n`);
      console.log(`[semantic-judge] ${packet.packet_id} ${judge}: ${result.judgments.length} judgments`);
    }
  }
  const adjudication = buildHumanAdjudicationPacket(blindPackets, existing.judgments);
  fs.writeFileSync(adjudicationPath, `${JSON.stringify(adjudication, null, 2)}\n`);
  console.log(`[semantic-judge] wrote ${out}`);
  console.log(`[semantic-judge] ${adjudication.cases.length} disagreement cases require condition-blind human adjudication`);
}

if (path.resolve(process.argv[1] || '') === SCRIPT_PATH) {
  try {
    await main();
  } catch (error) {
    console.error(`[semantic-judge] ${error.stack || error.message}`);
    process.exit(1);
  }
}
