#!/usr/bin/env node
// Program-2 Phase 1 — offline warrant-move grader + floor runner
// (PROGRAM-2-FINETUNE-PLAN.md §8 phase 1).
//
// Grades a tutor reply at a recorded trigger moment using ONLY frozen
// machinery: the sealed-trace turn bundle (services/tutorStubFrozenReplay.js,
// built for the V-series zero-call re-audits) supplies guard frames and the
// public-premise state; auditTutorStubFrozenCandidate runs the full response
// guard stack on the candidate text; auditTutorStubPointOfActionCompliance
// (detector step4-frozen-2026-07-14.v1) computes the compliance components.
// Nothing is re-derived; no LLM sits in the grading loop.
//
// Modes:
//   --validate            replay every historical delivered reply through the
//                         composed grader and compare with the sealed
//                         compliance verdicts (instrument-fidelity check;
//                         zero model calls)
//   --generate            call an OpenAI-compatible endpoint for each dev /
//                         heldout warrant_skip moment (greedy + sampled),
//                         grade, and write floor rows
//
// Usage:
//   node scripts/program2-floor-grader.mjs --validate \
//     --dataset ~/.machinespirits-data/program-2/datasets/v1 \
//     --step4 ~/.machinespirits-data/step4-claim-runs-2026-07 [--json out]
//   node scripts/program2-floor-grader.mjs --generate \
//     --dataset ... --step4 ... --base-url http://localhost:11434/v1 \
//     --model qwen3:8b [--splits dev,heldout] [--json out]
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';

import { loadWorld } from '../services/dramaticDerivation/world.js';
import { auditTutorStubFrozenCandidate } from '../services/tutorStubFrozenReplay.js';
import { auditTutorStubPointOfActionCompliance } from '../services/tutorStubPointOfActionCoaching.js';

const { values: args } = parseArgs({
  options: {
    validate: { type: 'boolean', default: false },
    generate: { type: 'boolean', default: false },
    dataset: {
      type: 'string',
      default: path.join(os.homedir(), '.machinespirits-data/program-2/datasets/v1'),
    },
    step4: {
      type: 'string',
      default: path.join(os.homedir(), '.machinespirits-data/step4-claim-runs-2026-07'),
    },
    'base-url': { type: 'string', default: 'http://localhost:11434/v1' },
    api: { type: 'string', default: 'ollama' },
    'num-ctx': { type: 'string', default: '16384' },
    'request-shape': { type: 'string', default: 'instruct' },
    model: { type: 'string' },
    splits: { type: 'string', default: 'dev,heldout' },
    limit: { type: 'string' },
    'grade-file': { type: 'string' },
    json: { type: 'string' },
  },
});
if (!args.validate && !args.generate && !args['grade-file']) {
  console.error('pick a mode: --validate, --generate, or --grade-file <jsonl> (see header)');
  process.exit(1);
}

const DATASET = args.dataset;
const STEP4 = args.step4;
const moments = fs
  .readFileSync(path.join(DATASET, 'eval-moments.jsonl'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line));

// ---- per-trace caches ----
const traceLinesCache = new Map();
function traceLines(file) {
  if (!traceLinesCache.has(file)) {
    traceLinesCache.set(
      file,
      fs
        .readFileSync(path.join(STEP4, file), 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line)),
    );
  }
  return traceLinesCache.get(file);
}
const worldCache = new Map();
function worldById(worldId) {
  if (!worldCache.has(worldId)) {
    const dir = path.resolve('config/drama-derivation');
    const file = fs
      .readdirSync(dir)
      .filter((name) => /^world-.*\.yaml$/u.test(name))
      .map((name) => path.join(dir, name))
      .find((candidate) => loadWorld(candidate).id === worldId);
    if (!file) throw new Error(`no world file for ${worldId}`);
    worldCache.set(worldId, loadWorld(file));
  }
  return worldCache.get(worldId);
}

// Step 4-compatible frozen-turn bundle. Mirrors the field mapping of
// extractTutorStubFrozenTurn (services/tutorStubFrozenReplay.js) minus the
// V-series first-draft-contract machinery, which was inactive in Step 4
// dialogues — the composition/progression audits correctly go inactive with
// firstDraftContract null. Step 4's recorded leak audits predate the
// publicPremiseIds field, so the public-premise state is reconstructed from
// the release_pacing_committed events (union of releasedNow at turns < t) —
// the same state the runtime's pacing layer held. The --validate replay
// measures this reconstruction's fidelity against the sealed verdicts.
function buildStep4Bundle(events, turn) {
  const complete = events.find((ev) => ev.type === 'turn_complete' && Number(ev.turn) === Number(turn));
  if (!complete?.turnRecord) throw new Error(`no completed turn ${turn}`);
  const record = complete.turnRecord;
  const accounting = record.tutorGuardAccounting || {};
  const modelCall = events.find(
    (ev) => ev.type === 'model_call' && ev.role === 'tutor_stub_tutor' && Number(ev.turn) === Number(turn),
  );
  const runStart = events.find((ev) => ev.type === 'run_start') || {};
  // Public state at generation time = premises released before this turn PLUS
  // the premises due for release this turn — the tutor is licensed to speak a
  // due premise, so it must not read as a leak (matching the live audit's
  // state, where dueNow entered the public set before the response audit).
  const dueNow = (record.dramaticRelease?.frame?.entries || []).map((entry) => entry.premise).filter(Boolean);
  const publicPremiseIds = [
    ...new Set([
      ...events
        .filter((ev) => ev.type === 'release_pacing_committed' && Number(ev.turn) < Number(turn))
        .flatMap((ev) => ev.releasedNow || []),
      ...dueNow,
    ]),
  ];
  const priorTurns = events
    .filter((ev) => ev.type === 'turn_complete' && Number(ev.turn) < Number(turn))
    .map((ev) => ({
      turn: Number(ev.turn),
      turnId: ev.turnRecord?.turnId || null,
      learner: ev.turnRecord?.learner || '',
      tutor: ev.turnRecord?.tutor || '',
    }));
  const messages = modelCall?.request?.messages || [];
  return {
    turn: Number(turn),
    turnId: record.turnId || null,
    worldId: runStart.metadata?.scenarioPicker?.selectedScenarioId || null,
    learnerText: record.learner || '',
    priorTurns,
    priorTutorTexts: messages.filter((m) => m.role === 'assistant').map((m) => m.content),
    selectedResponseConfiguration: record.responseConfiguration || null,
    firstDraftContract: null,
    frames: {
      responseComposition: record.responseComposition?.frame || null,
      dramaticRelease: record.dramaticRelease?.frame || null,
      questionSupport: record.questionSupport || null,
      dialogueClosure: record.dialogueClosure?.frame || null,
      generousInference: record.generousInference || null,
    },
    guards: accounting.guards || {},
    publicPremiseIds,
    duePremiseIds: (record.dramaticRelease?.frame?.entries || []).map((entry) => entry.premise).filter(Boolean),
  };
}

function momentContext(moment) {
  const events = traceLines(moment.trace.file);
  const assignment = events.find(
    (ev) => ev.type === 'point_of_action_assignment' && ev.turnId === moment.trace.turnId,
  )?.pointOfAction;
  const compliance = events.find(
    (ev) => ev.type === 'point_of_action_compliance' && ev.turnId === moment.trace.turnId && ev.compliance,
  )?.compliance;
  const turnRecord = events.find((ev) => ev.type === 'turn_complete' && ev.turnId === moment.trace.turnId)?.turnRecord;
  const bundle = buildStep4Bundle(events, moment.turn);
  return { assignment, compliance, turnRecord, bundle, world: worldById(bundle.worldId) };
}

// Grade candidate text at a moment with frozen machinery only. The runtime's
// released-premise count is reconstructed as "due premises the text actually
// delivers" (releaseDeliveryAudit); unscheduled premise content surfaces as a
// leak failure inside guardsPassed. guardsPassed mirrors the runtime's exact
// conjunction (scripts/tutor-stub.js ~13697): leak, scaffold, questionSupport,
// dramaticRelease, repetition, closure — NOT the full delivery decision
// (composition/actorial audits are outside the compliance definition).
// realizedActionFamily is unavailable for fresh text (no typed-action layer
// offline), so stagnant_repeat compliance is only computable in validation
// mode from the recorded family.
function gradeText({ context, text, realizedActionFamily = null }) {
  const { assignment, bundle, world } = context;
  const candidate = auditTutorStubFrozenCandidate({ bundle, world, text });
  const due = bundle.duePremiseIds || [];
  const missing = candidate.audits?.releaseDeliveryAudit?.missingPremises || [];
  const releasedPremiseCount = Math.max(0, due.length - missing.length);
  const audits = candidate.audits || {};
  const guardsPassed =
    audits.leakAudit?.ok !== false &&
    audits.scaffoldAudit?.ok !== false &&
    audits.questionSupportAudit?.ok !== false &&
    audits.dramaticReleaseAudit?.ok !== false &&
    audits.repetitionAudit?.ok !== false &&
    audits.closureAudit?.ok !== false;
  const compliance = auditTutorStubPointOfActionCompliance({
    turn: assignment,
    tutorText: candidate.auditedText,
    releasedPremiseCount,
    realizedActionFamily,
    guardsPassed,
  });
  return { candidate, compliance, releasedPremiseCount, guardsPassed };
}

// ---- validate mode ----
async function runValidate() {
  const rows = [];
  const disagreements = [];
  for (const moment of moments) {
    const context = momentContext(moment);
    if (!context.assignment || !context.compliance || !context.turnRecord) {
      disagreements.push({ id: moment.turnId, reason: 'missing sealed context' });
      continue;
    }
    const deliveredText = context.turnRecord.tutor;
    const graded = gradeText({
      context,
      text: deliveredText,
      realizedActionFamily: context.compliance.realized_action_family,
    });
    const recorded = context.compliance;
    const match = graded.compliance.compliant === recorded.compliant;
    const componentMatch = JSON.stringify(graded.compliance.components) === JSON.stringify(recorded.components);
    rows.push({
      turnId: moment.turnId,
      trigger: moment.trigger,
      split: moment.split,
      match,
      componentMatch,
    });
    if (!match || !componentMatch)
      disagreements.push({
        id: moment.turnId,
        trigger: moment.trigger,
        recorded: { compliant: recorded.compliant, components: recorded.components },
        graded: { compliant: graded.compliance.compliant, components: graded.compliance.components },
      });
  }
  const byTrigger = {};
  for (const trigger of ['warrant_skip', 'stagnant_repeat']) {
    const subset = rows.filter((row) => row.trigger === trigger);
    byTrigger[trigger] = {
      n: subset.length,
      verdictAgreement: subset.length ? subset.filter((row) => row.match).length / subset.length : null,
      componentAgreement: subset.length ? subset.filter((row) => row.componentMatch).length / subset.length : null,
    };
  }
  const report = {
    schema: 'machinespirits.program2.grader-validation.v1',
    mode: 'validate',
    moments: rows.length,
    byTrigger,
    disagreements: disagreements.slice(0, 50),
    disagreementCount: disagreements.length,
  };
  console.log(JSON.stringify({ moments: rows.length, byTrigger, disagreementCount: disagreements.length }, null, 2));
  if (args.json) fs.writeFileSync(args.json, JSON.stringify(report, null, 2));
}

// ---- generate mode ----
// Base-variant request shape (HANDOFF H1): the base sibling has no chat
// template, so the reconstructed request is flattened to a transcript-style
// completion prompt. This template is DRAFT v1 — it is frozen at Phase 2 as
// part of the instrument (PROGRAM-2-FINETUNE-PLAN.md §7); any change before
// the freeze must be re-floored.
const BASE_SHAPE_TEMPLATE_VERSION = 'program2-base-flatten.v1-draft';
function flattenForBase(request) {
  const lines = [request.systemPrompt.trim(), '', '--- Dialogue transcript ---'];
  for (const message of request.messages) {
    const speaker = message.role === 'assistant' ? 'Tutor' : 'Learner';
    lines.push('', `${speaker}: ${String(message.content).trim()}`);
  }
  lines.push('', 'Tutor:');
  return lines.join('\n');
}

// Plain node:http POST without socket timeouts — global fetch (undici)
// enforces a ~5-minute headers timeout, which slow local prefill of the
// ~10k-token prompts exceeds (observed: MLX server 200s arriving after the
// client had already given up).
function postJson(urlString, body) {
  const url = new URL(urlString);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`endpoint ${res.statusCode}: ${data.slice(0, 200)}`));
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      },
    );
    // A lost connection (e.g. the server restarted mid-request) must cost one
    // moment, not freeze the whole run: 10-minute per-request ceiling.
    req.setTimeout(600_000, () => req.destroy(new Error('request timeout (600s)')));
    req.on('error', reject);
    req.end(JSON.stringify(body));
  });
}

// Two endpoint styles: 'openai' (/chat/completions) and 'ollama' (native
// /api/chat or /api/generate for the base shape) — the native API is
// required with ollama because its OpenAI shim ignores num_ctx (silent
// prompt truncation at the ~4k default) and the think flag (qwen3 otherwise
// emits reasoning blocks into the reply).
async function callEndpoint({ request, temperature }) {
  if (args['request-shape'] === 'base') {
    const prompt = flattenForBase(request);
    if (args.api === 'ollama') {
      const data = await postJson(`${args['base-url'].replace(/\/v1\/?$/u, '')}/api/generate`, {
        model: args.model,
        prompt,
        raw: true,
        stream: false,
        options: {
          temperature,
          num_ctx: Number(args['num-ctx']),
          num_predict: request.config?.maxTokens || 1024,
          stop: ['\nLearner:', '\n---'],
        },
      });
      return data.response ?? '';
    }
    const data = await postJson(`${args['base-url']}/completions`, {
      model: args.model,
      prompt,
      temperature,
      max_tokens: request.config?.maxTokens || 1024,
      stop: ['\nLearner:', '\n---'],
      stream: false,
    });
    return data.choices?.[0]?.text ?? '';
  }
  const messages = [{ role: 'system', content: request.systemPrompt }, ...request.messages];
  if (args.api === 'ollama') {
    const data = await postJson(`${args['base-url'].replace(/\/v1\/?$/u, '')}/api/chat`, {
      model: args.model,
      messages,
      stream: false,
      think: false,
      options: {
        temperature,
        num_ctx: Number(args['num-ctx']),
        num_predict: request.config?.maxTokens || 1024,
      },
    });
    return data.message?.content ?? '';
  }
  const data = await postJson(`${args['base-url']}/chat/completions`, {
    model: args.model,
    messages,
    temperature,
    max_tokens: request.config?.maxTokens || 1024,
    stream: false,
  });
  return data.choices?.[0]?.message?.content ?? '';
}

async function runGenerate() {
  if (!args.model) throw new Error('--generate requires --model');
  const splits = new Set(args.splits.split(','));
  let targets = moments.filter((m) => splits.has(m.split) && m.trigger === 'warrant_skip' && m.request);
  if (args.limit) targets = targets.slice(0, Number(args.limit));
  const decodings = [
    { name: 'greedy', temperature: 0 },
    { name: 'sampled', temperature: 0.35 },
  ];
  const rows = [];
  let done = 0;
  for (const moment of targets) {
    const context = momentContext(moment);
    for (const decoding of decodings) {
      let text = null;
      let error = null;
      try {
        text = await callEndpoint({ request: moment.request, temperature: decoding.temperature });
      } catch (err) {
        error = String(err.message || err).slice(0, 300);
      }
      const graded = text ? gradeText({ context, text }) : null;
      rows.push({
        turnId: moment.turnId,
        split: moment.split,
        family: moment.family,
        arm: moment.arm,
        profile: moment.profile,
        decoding: decoding.name,
        error,
        text,
        compliant: graded ? graded.compliance.compliant : null,
        components: graded ? graded.compliance.components : null,
        guardOk: graded ? graded.candidate.ok : null,
        safetyFailure: graded ? graded.candidate.safetyFailure : null,
        releasedPremiseCount: graded ? graded.releasedPremiseCount : null,
      });
    }
    done += 1;
    if (done % 10 === 0) console.error(`[floor] ${done}/${targets.length} moments`);
  }
  const summary = {};
  for (const decoding of decodings) {
    for (const split of splits) {
      const subset = rows.filter((r) => r.decoding === decoding.name && r.split === split && !r.error);
      const key = `${decoding.name}/${split}`;
      summary[key] = {
        n: subset.length,
        errors: rows.filter((r) => r.decoding === decoding.name && r.split === split && r.error).length,
        complianceRate: subset.length ? subset.filter((r) => r.compliant).length / subset.length : null,
        guardOkRate: subset.length ? subset.filter((r) => r.guardOk).length / subset.length : null,
        componentFailures: ['exactly_one_question', 'warrant_cue', 'no_new_premise', 'guards_passed'].map(
          (component) => ({
            component,
            failures: subset.filter((r) => r.components && r.components[component] === false).length,
          }),
        ),
      };
    }
  }
  const report = {
    schema: 'machinespirits.program2.floor-report.v1',
    mode: 'generate',
    model: args.model,
    baseUrl: args['base-url'],
    requestShape: args['request-shape'],
    baseShapeTemplate: args['request-shape'] === 'base' ? BASE_SHAPE_TEMPLATE_VERSION : null,
    momentCount: targets.length,
    summary,
    rows,
  };
  console.log(JSON.stringify({ model: args.model, momentCount: targets.length, summary }, null, 2));
  if (args.json) fs.writeFileSync(args.json, JSON.stringify(report, null, 2));
}

// ---- grade-file mode: grade externally produced texts at their moments
// with the identical frozen machinery (used by the coupling probe) ----
async function runGradeFile() {
  const provided = fs
    .readFileSync(args['grade-file'], 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const byTurnId = new Map(moments.map((m) => [m.turnId, m]));
  const rows = [];
  for (const item of provided) {
    const moment = byTurnId.get(item.turnId);
    if (!moment) throw new Error('unknown turnId ' + item.turnId);
    const context = momentContext(moment);
    const graded = gradeText({ context, text: item.text });
    rows.push({
      turnId: item.turnId,
      split: moment.split,
      family: moment.family,
      source: item.source || null,
      compliant: graded.compliance.compliant,
      components: graded.compliance.components,
      guardOk: graded.guardsPassed,
      safetyFailure: graded.candidate.safetyFailure,
      text: item.text,
    });
  }
  const n = rows.length;
  const summary = {
    n,
    complianceRate: n ? rows.filter((r) => r.compliant).length / n : null,
    guardOkRate: n ? rows.filter((r) => r.guardOk).length / n : null,
    componentFailures: ['exactly_one_question', 'warrant_cue', 'no_new_premise', 'guards_passed'].map((component) => ({
      component,
      failures: rows.filter((r) => r.components && r.components[component] === false).length,
    })),
    bySource: Object.fromEntries(
      [...new Set(rows.map((r) => r.source))].map((src) => [
        src,
        {
          n: rows.filter((r) => r.source === src).length,
          compliant: rows.filter((r) => r.source === src && r.compliant).length,
        },
      ]),
    ),
  };
  const report = { schema: 'machinespirits.program2.grade-file-report.v1', file: args['grade-file'], summary, rows };
  console.log(JSON.stringify(summary, null, 2));
  if (args.json) fs.writeFileSync(args.json, JSON.stringify(report, null, 2));
}

if (args.validate) await runValidate();
if (args.generate) await runGenerate();
if (args['grade-file']) await runGradeFile();
