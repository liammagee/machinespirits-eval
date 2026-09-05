/**
 * Step 2 reader seats and scorer for the scoreboard crossed run
 * (notes/2026-09-04-scoreboard-replay-prompt.md).
 *
 * The board reader (services/tutorStubScoreboard.js) is the program. This
 * module adds two model reader seats over the public dialogue text and the
 * zero-call scorer that reads the endpoints and the two kill rules.
 *
 * Reader packets carry public text only: no board, no trace internals, no
 * tutor decision at the point under judgement.
 *   - warrant packet: for each learner turn N, the public record through
 *     learner turn N. The reader answers whether the tutor should change its
 *     held approach at this point (the §6.25 question, yes|no|uncertain).
 *   - delivery packet: for each turn N, learner turn N and the tutor reply N.
 *     The reader marks what the reply does (challenge, release, test offer,
 *     condition named, close) with a quoted span for each yes.
 *
 * No approval ceremony. The spend ceiling is `maxCalls`, checked before each
 * call. Retries 0. A failed call is recorded and the run stops.
 */

import fs from 'node:fs';
import path from 'node:path';

import { callAIWithCliBridge } from './cliProviderBridge.js';
import { splitModelSpec } from './registerStrongStackReplication.js';
import {
  buildScoreboard,
  extractTraceTurns,
  loadScoreboardWorld,
  readTutorStubTraceEvents,
  traceDialogueIdentity,
} from './tutorStubScoreboard.js';
import { PROFILE_TO_SHAPE } from './tutorStubScoreboardShapes.js';
import { TUTOR_STUB_SCOREBOARD_BLIND_POLICY, TUTOR_STUB_SCOREBOARD_BOARD_POLICY } from './tutorStubScoreboardPolicy.js';

export const SCOREBOARD_CROSSED_READER_SCHEMA = 'machinespirits.tutor-stub.scoreboard-crossed-reader.v1';
export const SCOREBOARD_CROSSED_SCORE_SCHEMA = 'machinespirits.tutor-stub.scoreboard-crossed-score.v1';
export const DEFAULT_READER_MODEL = 'codex.gpt-5.6-luna';
export const DEFAULT_READER_COUNT = 2;
export const PACKET_KINDS = Object.freeze(['warrant', 'delivery']);
export const DELIVERY_FIELDS = Object.freeze([
  'challenge_delivered',
  'clue_released',
  'test_offered',
  'condition_named',
  'inquiry_closed',
]);
const YES_NO_UNCERTAIN = Object.freeze(['yes', 'no', 'uncertain']);

const READER_SYSTEM_PROMPT =
  'You are one isolated independent research reader. Use only the supplied packet. Return exactly the schema-bound JSON object and do not use tools.';

const isTrace = (f) => f.endsWith('.jsonl') || f.endsWith('.jsonl.gz');

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) walkFiles(p, out);
    else out.push(p);
  }
  return out;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, value) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tmp, p);
}

function resolvedModel(events) {
  const start = events.find((e) => e?.type === 'run_start') || {};
  const r = start.metadata?.resolved || {};
  return r.provider && r.model ? `${r.provider}.${r.model}` : null;
}

/** Walk trace roots; keep the fullest trace per world|profile|policy|repeat. */
export function collectCrossedDialogues(rootDirs = []) {
  const seen = new Map();
  for (const root of rootDirs) {
    for (const p of walkFiles(root).filter(isTrace)) {
      const events = readTutorStubTraceEvents(p);
      const identity = traceDialogueIdentity(events);
      if (!identity.profile || !identity.policy) continue;
      const key = `${identity.worldId}|${identity.profile}|${identity.policy}|${identity.repeat}`;
      const rec = {
        id: `${identity.worldId}-${identity.profile}-${identity.policy}-r${identity.repeat}`,
        key,
        tracePath: p,
        identity,
        events,
        tutorModel: resolvedModel(events),
        eventCount: events.length,
      };
      const prev = seen.get(key);
      if (!prev || rec.eventCount > prev.eventCount) seen.set(key, rec);
    }
  }
  return [...seen.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function publicTurns(events) {
  return extractTraceTurns(events).map((t) => ({
    turn: t.turn,
    opening: Boolean(t.opening),
    learner: t.learnerText,
    tutor: t.tutorText,
  }));
}

/** Build the two public-text packets for one dialogue. */
export function buildReaderPackets(dialogue) {
  const turns = publicTurns(dialogue.events);
  const opening = turns.find((t) => t.opening)?.tutor || null;
  const body = turns.filter((t) => !t.opening);
  const warrantCases = body.map((t) => {
    const record = [];
    if (opening) record.push({ turn: 0, speaker: 'tutor', text: opening });
    for (const prev of body) {
      if (prev.turn > t.turn) break;
      if (prev.learner) record.push({ turn: prev.turn, speaker: 'learner', text: prev.learner });
      if (prev.turn < t.turn && prev.tutor) record.push({ turn: prev.turn, speaker: 'tutor', text: prev.tutor });
    }
    return { sample_id: `${dialogue.id}:t${t.turn}`, decision_turn: t.turn, public_record: record };
  });
  const deliveryCases = body
    .filter((t) => typeof t.tutor === 'string' && t.tutor.trim())
    .map((t) => ({
      sample_id: `${dialogue.id}:t${t.turn}`,
      turn: t.turn,
      learner_turn: t.learner,
      tutor_reply: t.tutor,
    }));
  return {
    warrant: {
      schema: SCOREBOARD_CROSSED_READER_SCHEMA,
      kind: 'warrant',
      dialogue_id: dialogue.id,
      instructions: [
        'Each case is one decision point: the public record through the learner turn named by decision_turn. The tutor reply at that turn is withheld.',
        'For each case answer commitment_transition_warranted: whether the tutor should change its held approach beyond this point, given only the public record. yes means a change is warranted; no means the held approach should continue; use uncertain only when the record does not decide it.',
        'A learner who asks permission or asks the tutor to choose is not by itself a warrant. An unsupported claim, a premature answer to the whole inquiry, a dropped clue, or a defaulted challenge is a warrant.',
        'Write one sentence in note that quotes the public evidence you used.',
        'Return one JSON object with cases_by_sample_id keyed by every sample_id and nothing else.',
      ],
      cases: warrantCases,
    },
    delivery: {
      schema: SCOREBOARD_CROSSED_READER_SCHEMA,
      kind: 'delivery',
      dialogue_id: dialogue.id,
      instructions: [
        'Each case is one learner turn and the tutor reply to it. Judge only what the reply does in public.',
        'challenge_delivered: the reply asks the learner to back a claim, or names a claim as unsupported.',
        'clue_released: the reply gives the learner a new fact about the case.',
        'test_offered: the reply offers or sets a check the learner can do.',
        'condition_named: the reply names a condition under which the tutor will act.',
        'inquiry_closed: the reply closes the inquiry as complete.',
        'For each yes give the exact words from the reply in the matching span field; leave the span empty for no.',
        'Return one JSON object with cases_by_sample_id keyed by every sample_id and nothing else.',
      ],
      cases: deliveryCases,
    },
  };
}

function ynProp(description) {
  return { type: 'string', enum: YES_NO_UNCERTAIN, description };
}

export function readerOutputSchema(kind, sampleIds) {
  const caseProps =
    kind === 'warrant'
      ? {
          commitment_transition_warranted: ynProp('Should the tutor change its held approach beyond this point.'),
          note: { type: 'string' },
        }
      : {
          ...Object.fromEntries(DELIVERY_FIELDS.map((f) => [f, ynProp(`Does the reply do this: ${f}.`)])),
          ...Object.fromEntries(DELIVERY_FIELDS.map((f) => [`${f}_span`, { type: 'string' }])),
        };
  const caseSchema = {
    type: 'object',
    additionalProperties: false,
    required: Object.keys(caseProps),
    properties: caseProps,
  };
  return {
    type: 'object',
    additionalProperties: false,
    required: ['cases_by_sample_id'],
    properties: {
      cases_by_sample_id: {
        type: 'object',
        additionalProperties: false,
        required: sampleIds,
        properties: Object.fromEntries(sampleIds.map((id) => [id, caseSchema])),
      },
    },
  };
}

function parseReaderResponse(text, sampleIds, label) {
  let parsed;
  try {
    parsed = JSON.parse(String(text || '').trim());
  } catch (error) {
    throw new Error(`${label} returned invalid JSON: ${error.message}`);
  }
  const cases = parsed?.cases_by_sample_id;
  if (!cases || typeof cases !== 'object') throw new Error(`${label} response has no cases_by_sample_id`);
  const got = Object.keys(cases).sort();
  const want = [...sampleIds].sort();
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${label} response sample-id mismatch`);
  return parsed;
}

export function plannedReaderCalls(dialogues, readerCount = DEFAULT_READER_COUNT) {
  return dialogues.length * PACKET_KINDS.length * readerCount;
}

/**
 * Run the reader seats. Zero calls when dryRun. The ceiling `maxCalls` is
 * checked before every call. A call that fails stops the run; nothing is
 * retried and nothing is resampled.
 */
export async function runScoreboardCrossedReaders({
  rootDirs,
  outDir,
  readerModel = DEFAULT_READER_MODEL,
  readerCount = DEFAULT_READER_COUNT,
  effort = 'medium',
  maxCalls = null,
  dryRun = false,
  callModel = callAIWithCliBridge,
  log = () => {},
} = {}) {
  const dialogues = collectCrossedDialogues(rootDirs);
  if (!dialogues.length) throw new Error('no dialogue traces found under the trace roots');
  const spec = splitModelSpec(readerModel);
  if (!spec.provider || !spec.model) throw new Error(`reader model must use dot notation: ${readerModel}`);
  if (/nemotron|kimi/iu.test(readerModel)) throw new Error('nemotron/kimi may not hold any seat');
  const tutorModels = [...new Set(dialogues.map((d) => d.tutorModel).filter(Boolean))].sort();
  if (tutorModels.includes(readerModel)) {
    throw new Error(`no self-judging: reader model ${readerModel} also held a tutor seat`);
  }
  const planned = plannedReaderCalls(dialogues, readerCount);
  if (!dryRun && (!Number.isInteger(maxCalls) || maxCalls < planned)) {
    throw new Error(`--max-calls must be an integer at or above the planned ${planned} calls`);
  }
  const resolvedOut = path.resolve(outDir);
  const runPath = path.join(resolvedOut, 'reader-run.json');
  const run = fs.existsSync(runPath)
    ? readJson(runPath)
    : {
        schema: SCOREBOARD_CROSSED_READER_SCHEMA,
        status: 'prepared',
        reader_model: readerModel,
        reader_count: readerCount,
        effort,
        tutor_models: tutorModels,
        dialogues: dialogues.length,
        planned_calls: planned,
        max_calls: maxCalls,
        calls_attempted: 0,
        calls_completed: 0,
        calls_failed: 0,
        failures: [],
        started_at: new Date().toISOString(),
      };
  run.reader_model = readerModel;
  run.max_calls = maxCalls;
  fs.mkdirSync(resolvedOut, { recursive: true });

  const packetsWritten = [];
  for (const d of dialogues) {
    const packets = buildReaderPackets(d);
    for (const kind of PACKET_KINDS) {
      const p = path.join(resolvedOut, 'packets', `${d.id}.${kind}.json`);
      writeJson(p, packets[kind]);
      packetsWritten.push(p);
    }
  }
  if (dryRun) {
    run.status = 'dry_run';
    writeJson(runPath, run);
    log(`dry run: ${dialogues.length} dialogues, ${packetsWritten.length} packets, ${planned} calls planned, 0 made`);
    return { run, dialogues: dialogues.length, packets: packetsWritten.length, plannedCalls: planned, callsMade: 0 };
  }

  run.status = 'running';
  writeJson(runPath, run);
  let callsMade = 0;
  for (const d of dialogues) {
    const packets = buildReaderPackets(d);
    for (const kind of PACKET_KINDS) {
      const packet = packets[kind];
      const sampleIds = packet.cases.map((c) => c.sample_id);
      for (let r = 1; r <= readerCount; r += 1) {
        const readerId = `reader-${r}`;
        const outPath = path.join(resolvedOut, 'responses', readerId, `${d.id}.${kind}.json`);
        if (fs.existsSync(outPath)) continue;
        if (run.calls_attempted >= maxCalls) {
          run.status = 'stopped_at_ceiling';
          writeJson(runPath, run);
          throw new Error(`reader call ceiling ${maxCalls} reached before ${readerId} ${d.id}.${kind}`);
        }
        run.calls_attempted += 1;
        writeJson(runPath, run);
        const label = `${readerId} ${d.id}.${kind}`;
        try {
          const result = await callModel(
            { provider: spec.provider, model: spec.model },
            READER_SYSTEM_PROMPT,
            JSON.stringify(packet),
            `scoreboard-crossed-${readerId}-${kind}`,
            {
              outputSchema: readerOutputSchema(kind, sampleIds),
              effort,
              timeoutMs: 600_000,
              maxStdoutBytes: 512_000,
              maxStderrBytes: 64_000,
            },
          );
          const parsed = parseReaderResponse(result?.text, sampleIds, label);
          writeJson(outPath, {
            schema: SCOREBOARD_CROSSED_READER_SCHEMA,
            reader_id: readerId,
            reader_model: readerModel,
            kind,
            dialogue_id: d.id,
            ...parsed,
          });
          run.calls_completed += 1;
          callsMade += 1;
          writeJson(runPath, run);
          log(`${label}: ok (${run.calls_completed}/${planned})`);
        } catch (error) {
          run.calls_failed += 1;
          run.failures.push({ reader_id: readerId, dialogue_id: d.id, kind, message: error.message });
          run.status = 'stopped_on_failure';
          writeJson(runPath, run);
          throw new Error(`${label} failed; run stopped, retries 0: ${error.message}`);
        }
      }
    }
  }
  run.status = 'complete';
  run.finished_at = new Date().toISOString();
  writeJson(runPath, run);
  return { run, dialogues: dialogues.length, packets: packetsWritten.length, plannedCalls: planned, callsMade };
}

// ---------------------------------------------------------------------------
// Scorer (zero calls)
// ---------------------------------------------------------------------------

const has = (value, token) => typeof value === 'string' && value.split('+').includes(token);
const worldCache = new Map();
function worldFor(worldId, rootDir) {
  if (!worldId) return null;
  const key = `${rootDir}|${worldId}`;
  if (!worldCache.has(key)) {
    let world = null;
    try {
      world = loadScoreboardWorld(worldId, { rootDir });
    } catch {
      world = null;
    }
    worldCache.set(key, world);
  }
  return worldCache.get(key);
}

function readResponses(readerDir, dialogueId, kind) {
  const out = [];
  const base = path.join(readerDir, 'responses');
  if (!fs.existsSync(base)) return out;
  for (const readerId of fs.readdirSync(base).sort()) {
    const p = path.join(base, readerId, `${dialogueId}.${kind}.json`);
    if (fs.existsSync(p)) out.push(readJson(p));
  }
  return out;
}

/** Two-reader consensus on one yes/no field; null when readers split or any is uncertain. */
export function consensus(values) {
  if (!values.length || values.length < 2) return null;
  const set = new Set(values);
  if (set.size !== 1) return null;
  const v = values[0];
  return v === 'yes' || v === 'no' ? v : null;
}

/** The board channel for each shape, read by the program from one board. */
export function boardChannel(board, shape) {
  const learnerRows = board.rows.filter((r) => r.speaker === 'learner');
  const tutorRows = board.rows.filter((r) => r.speaker === 'tutor');
  if (shape === 'permission_seeking') {
    const hits = learnerRows.filter(
      (r) =>
        (r.provenance?.nodeCommitments || []).length > 0 &&
        !(r.provenance?.grantInForce || (r.provenance?.requests || 0) > 0),
    );
    return { channel: 'commitment_without_licence', hits: hits.map((r) => r.turn), fired: hits.length > 0 };
  }
  if (shape === 'overconfident') {
    const challengeTurns = tutorRows.filter((r) => has(r.fields.challenge, 'issued')).map((r) => r.turn);
    const firstChallenge = challengeTurns.length ? Math.min(...challengeTurns) : null;
    const hits = [];
    if (firstChallenge !== null) {
      const notWarrantedBefore = new Set();
      for (const r of learnerRows) {
        const nodes = r.provenance?.nodeCommitments || [];
        if (r.turn <= firstChallenge) {
          if (r.fields.entitlement_status !== 'warranted') nodes.forEach((n) => notWarrantedBefore.add(n));
          continue;
        }
        const repaired = nodes.some((n) => notWarrantedBefore.has(n)) && r.fields.entitlement_status === 'warranted';
        if (repaired || has(r.fields.challenge, 'answered')) hits.push(r.turn);
      }
    }
    return { channel: 'entitlement_repaired_after_challenge', hits, fired: hits.length > 0 };
  }
  return { channel: null, hits: [], fired: false };
}

function rate(hits, n) {
  return n ? hits / n : null;
}

function emptyCell(profile, policy) {
  return {
    profile,
    policy,
    shape: PROFILE_TO_SHAPE[profile] || null,
    dialogues: 0,
    turns: 0,
    channel_fired: 0,
    channel_hits: 0,
    consensus_cases: 0,
    warranted_consensus: 0,
    tutor_challenges: 0,
    decisions_correct: 0,
    delivery_consensus: 0,
    delivery_agree: 0,
    licence_violations: 0,
    licence_violation_dialogues: [],
  };
}

/**
 * Score one crossed run: per cell (profile x policy) the board channel, the
 * §6.25 decision correctness, the §6.26 warranted shift share, delivery
 * agreement, and the two kill rules.
 */
export function scoreScoreboardCrossedRun({ rootDirs, readerDir = null, repoRoot = process.cwd() } = {}) {
  const dialogues = collectCrossedDialogues(rootDirs);
  const cells = new Map();
  const perDialogue = [];
  for (const d of dialogues) {
    const { profile, policy, worldId } = d.identity;
    const key = `${profile}|${policy}`;
    if (!cells.has(key)) cells.set(key, emptyCell(profile, policy));
    const cell = cells.get(key);
    const board = buildScoreboard({
      events: d.events,
      world: worldFor(worldId, repoRoot),
      arm: policy,
      identity: d.identity,
    });
    const channel = boardChannel(board, cell.shape);
    const violations = d.events.filter((e) => e?.type === 'scoreboard_licence_violation');
    cell.dialogues += 1;
    cell.turns += board.counts.turns;
    if (channel.fired) cell.channel_fired += 1;
    cell.channel_hits += channel.hits.length;
    cell.licence_violations += violations.length;
    if (violations.length) cell.licence_violation_dialogues.push(d.id);

    const decisions = [];
    if (readerDir) {
      const warrant = readResponses(readerDir, d.id, 'warrant');
      const delivery = readResponses(readerDir, d.id, 'delivery');
      for (const row of board.rows.filter((r) => r.speaker === 'tutor')) {
        const sampleId = `${d.id}:t${row.turn}`;
        const challenged = has(row.fields.challenge, 'issued');
        const w = consensus(
          warrant.map((resp) => resp.cases_by_sample_id?.[sampleId]?.commitment_transition_warranted),
        );
        const dv = consensus(delivery.map((resp) => resp.cases_by_sample_id?.[sampleId]?.challenge_delivered));
        if (challenged) cell.tutor_challenges += 1;
        if (w) {
          cell.consensus_cases += 1;
          if (w === 'yes') cell.warranted_consensus += 1;
          if ((w === 'yes') === challenged) cell.decisions_correct += 1;
        }
        if (dv) {
          cell.delivery_consensus += 1;
          if ((dv === 'yes') === challenged) cell.delivery_agree += 1;
        }
        decisions.push({ turn: row.turn, tutor_challenged: challenged, warrant_consensus: w, delivery_consensus: dv });
      }
    }
    perDialogue.push({
      id: d.id,
      tracePath: d.tracePath,
      profile,
      policy,
      worldId,
      tutorModel: d.tutorModel,
      channel,
      licence_violations: violations.length,
      decisions,
    });
  }

  const cellList = [...cells.values()].map((c) => ({
    ...c,
    channel_share: rate(c.channel_fired, c.dialogues),
    decision_correctness: rate(c.decisions_correct, c.consensus_cases),
    warranted_shift_share: rate(c.warranted_consensus, c.consensus_cases),
    delivery_agreement: rate(c.delivery_agree, c.delivery_consensus),
  }));
  const cellFor = (profile, policy) => cellList.find((c) => c.profile === profile && c.policy === policy) || null;
  const channels = [];
  for (const profile of [...new Set(cellList.map((c) => c.profile))].sort()) {
    const board = cellFor(profile, TUTOR_STUB_SCOREBOARD_BOARD_POLICY);
    const blind = cellFor(profile, TUTOR_STUB_SCOREBOARD_BLIND_POLICY);
    channels.push({
      profile,
      shape: PROFILE_TO_SHAPE[profile] || null,
      board_share: board?.channel_share ?? null,
      blind_share: blind?.channel_share ?? null,
      board_beats_blind:
        board && blind && board.channel_share !== null && blind.channel_share !== null
          ? board.channel_share > blind.channel_share
          : null,
    });
  }
  const decided = channels.filter((c) => c.board_beats_blind !== null);
  const anyWin = decided.some((c) => c.board_beats_blind);
  const licenceDialogues = perDialogue.filter((d) => d.licence_violations > 0).map((d) => d.id);
  const readerModels = readerDir ? readerModelsIn(readerDir) : [];
  const tutorModels = [...new Set(dialogues.map((d) => d.tutorModel).filter(Boolean))].sort();
  return {
    schema: SCOREBOARD_CROSSED_SCORE_SCHEMA,
    dialogues: dialogues.length,
    seats: { tutor_models: tutorModels, reader_models: readerModels },
    self_judging: readerModels.some((m) => tutorModels.includes(m)),
    cells: cellList,
    channels,
    kill: {
      board_not_above_blind_on_either_channel: decided.length ? !anyWin : null,
      licence_violation: licenceDialogues.length > 0,
      licence_violation_dialogues: licenceDialogues,
      indeterminate: decided.length === 0,
    },
    per_dialogue: perDialogue,
  };
}

function readerModelsIn(readerDir) {
  const p = path.join(readerDir, 'reader-run.json');
  if (!fs.existsSync(p)) return [];
  const run = readJson(p);
  return run.reader_model ? [run.reader_model] : [];
}

function pct(x) {
  return x === null || x === undefined ? 'n/a' : `${(x * 100).toFixed(0)}%`;
}

export function renderCrossedScoreMarkdown(score) {
  const lines = [];
  lines.push(`Dialogues: ${score.dialogues}`);
  lines.push(`Tutor seat models: ${score.seats.tutor_models.join(', ') || 'unknown'}`);
  lines.push(`Reader seat models: ${score.seats.reader_models.join(', ') || 'none run'}`);
  lines.push(`Self-judging: ${score.self_judging ? 'YES (defect)' : 'no'}`);
  lines.push('');
  lines.push(
    '| profile | policy | dialogues | channel fired | decision correctness | warranted shift share | delivery agreement | licence violations |',
  );
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const c of score.cells) {
    lines.push(
      `| ${c.profile} | ${c.policy} | ${c.dialogues} | ${c.channel_fired}/${c.dialogues} (${pct(c.channel_share)}) | ${c.decisions_correct}/${c.consensus_cases} (${pct(c.decision_correctness)}) | ${c.warranted_consensus}/${c.consensus_cases} (${pct(c.warranted_shift_share)}) | ${c.delivery_agree}/${c.delivery_consensus} (${pct(c.delivery_agreement)}) | ${c.licence_violations} |`,
    );
  }
  lines.push('');
  for (const ch of score.channels) {
    const verdict =
      ch.board_beats_blind === null
        ? 'not decided'
        : ch.board_beats_blind
          ? 'board above blind'
          : 'board not above blind';
    lines.push(`- ${ch.shape} channel: board ${pct(ch.board_share)}, blind ${pct(ch.blind_share)}: ${verdict}.`);
  }
  lines.push('');
  const k = score.kill;
  lines.push(
    `Kill 1 (board not above blind on either channel): ${k.board_not_above_blind_on_either_channel === null ? 'indeterminate' : k.board_not_above_blind_on_either_channel ? 'FIRED' : 'not fired'}.`,
  );
  lines.push(
    `Kill 2 (licence violation by the program): ${k.licence_violation ? `FIRED in ${k.licence_violation_dialogues.join(', ')}` : 'not fired'}.`,
  );
  if (k.indeterminate) lines.push('Indeterminate: stop.');
  return `${lines.join('\n')}\n`;
}
