#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import yaml from 'yaml';
import { loadContinuityPlan, continuityBudget, runContinuityArm } from '../services/localQwenRefusalContinuity.js';
import { manageServer, discoverLoadedModel } from './run-local-qwen-resistant-learner.js';
import { buildRefusalPlan } from './run-local-qwen-hostile-refusal.js';
import {
  readBenchmarkArm,
  buildBenchmarkJobs,
  parseBenchmarkScore,
  normalizeScores,
  BENCHMARK_JUDGE,
} from './score-local-qwen-resistant-learner-benchmark.js';
import { callAIWithCliBridge } from '../services/cliProviderBridge.js';
import { renderBilateralReport } from '../services/localQwenBilateralReport.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = 'config/tutor-stub-local-learners/qwen-refusal-bilateral-superego.v1.yaml';
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const normalized = (s) => s.normalize('NFC').replace(/[‘’]/gu, "'");

export function deliveredSourceContext(plan, arm) {
  const records = arm.snapshot.proofControl.releasedPremiseIds.map((id) => {
    const source = plan.world.premises.find((p) => p.id === id);
    const turn = arm.snapshot.turns.find((t) => normalized(t.tutor).includes(normalized(source.surface)));
    if (!turn) throw new Error('committed source is absent from the final public transcript');
    return `Delivered in housemate turn ${turn.turn}: ${source.surface}`;
  });
  return [
    `Public opening situation supplied to both speakers: ${plan.world.opening_frame.situation}`,
    'The housemate is authorized to introduce these authored observations. New disclosed scene evidence is not automatically an invented assertion.',
    ...records,
  ].join('\n');
}

function inspectRejectedAssessment(transport, kind, count) {
  if (!transport?.stdout?.trim()) return { nonempty: false };
  const payload = JSON.parse(transport.stdout);
  const events = Array.isArray(payload) ? payload : [payload];
  const messages = events.filter((e) => e.type === 'assistant');
  const blocks = messages.flatMap((e) => e.message?.content || []);
  const calls = blocks.filter((b) => b.type === 'tool_use');
  const nonempty =
    calls.some((b) => b.input && Object.keys(b.input).length) ||
    blocks.some((b) => b.type === 'text' && b.text?.trim());
  if (!nonempty) return { nonempty: false };
  if (
    new Set(messages.map((e) => e.message.id)).size !== 1 ||
    calls.length !== 1 ||
    calls[0].name !== 'StructuredOutput' ||
    events.find((e) => e.type === 'system' && e.subtype === 'init')?.model !== BENCHMARK_JUDGE.model
  )
    return { nonempty: true };
  try {
    const { parsed, indexNormalization } = parseBenchmarkScore(kind, JSON.stringify(calls[0].input), count, {
      extendedQuality: true,
      allowOneBasedIndices: true,
    });
    return { nonempty: true, parsed, indexNormalization, messageId: messages[0].message.id };
  } catch (error) {
    // Nonempty malformed content is not an empty-response retry. Return to the
    // caller so its stop record retains prior scores and the failed attempt.
    return { nonempty: true, parseError: error.message };
  }
}

// Reuses the existing jobs, strict score parser and local aggregate functions.
// At most one recovery for an empty provider result; never resample a judgment.
export async function scoreBilateralArms(
  arms,
  outDir,
  { budget, assessmentContext, publicSourceContextByArm, callJudge = callAIWithCliBridge } = {},
) {
  fs.mkdirSync(outDir, { recursive: false });
  const jobs = buildBenchmarkJobs(arms, { extendedQuality: true, assessmentContext, publicSourceContextByArm });
  const scores = [],
    failures = [],
    recoveries = [];
  let attemptsUsed = 0;
  const record = (event) =>
    fs.appendFileSync(
      path.join(outDir, 'judge-ledger.jsonl'),
      `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`,
    );
  for (const job of jobs) {
    const count = arms.find((a) => a.id === job.arm).snapshot.turns.length;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const prefix = path.join(outDir, `${job.arm}-${job.kind}-attempt-${attempt}`);
      write(`${prefix}.request.json`, { judge: BENCHMARK_JUDGE, prompt: job.prompt, schema: job.outputSchema });
      const reservation = budget.reserve({ role: `local-qwen-benchmark-${job.kind}` });
      attemptsUsed++;
      record({ event: 'reserved', arm: job.arm, kind: job.kind, attempt, ...reservation });
      console.log(
        `${job.arm} Opus ${job.kind} attempt ${attempt}; ${reservation.call}/${reservation.limit} total attempts reserved`,
      );
      let transport;
      try {
        const response = await callJudge(BENCHMARK_JUDGE, '', job.prompt, `local-qwen-benchmark-${job.kind}`, {
          effort: BENCHMARK_JUDGE.effort,
          timeoutMs: 600_000,
          rawUserPrompt: true,
          preserveDefaultSystemPrompt: true,
          outputSchema: job.outputSchema,
          singleAttempt: true,
          onRawOutput: (value) => {
            transport = value;
            write(`${prefix}.transport.json`, value);
          },
        });
        write(`${prefix}.provider.json`, response);
        const { parsed, indexNormalization } = parseBenchmarkScore(job.kind, response.text, count, {
          extendedQuality: true,
          allowOneBasedIndices: true,
        });
        scores.push({
          arm: job.arm,
          kind: job.kind,
          raw: parsed,
          scored: normalizeScores(job.kind, parsed),
          indexNormalization,
        });
        record({ event: 'completed', arm: job.arm, kind: job.kind, attempt, call: reservation.call });
        break;
      } catch (error) {
        const failure = {
          arm: job.arm,
          kind: job.kind,
          attempt,
          call: reservation.call,
          message: error.message,
          code: error.code,
        };
        failures.push(failure);
        write(`${prefix}.error.json`, failure);
        record({ event: 'failed', ...failure });
        let inspected = { nonempty: true };
        if (error.code === 'CLI_PROVIDER_RESPONSE_FREE_ERROR')
          inspected = inspectRejectedAssessment(transport, job.kind, count);
        if (inspected.parsed) {
          const recovery = {
            arm: job.arm,
            kind: job.kind,
            source: `${prefix}.transport.json`,
            newModelCalls: 0,
            reason:
              'Complete preserved StructuredOutput payload validated unchanged by the existing score parser after envelope rejection.',
            messageId: inspected.messageId,
          };
          recoveries.push(recovery);
          write(`${prefix}.offline-recovery.json`, {
            ...recovery,
            raw: inspected.parsed,
            indexNormalization: inspected.indexNormalization,
          });
          scores.push({
            arm: job.arm,
            kind: job.kind,
            raw: inspected.parsed,
            scored: normalizeScores(job.kind, inspected.parsed),
            indexNormalization: inspected.indexNormalization,
            offlineRecovery: recovery,
          });
          record({ event: 'offline_recovered', arm: job.arm, kind: job.kind, call: reservation.call });
          console.log(`${job.arm} ${job.kind} recovered unchanged without a new call`);
          break;
        }
        if (attempt === 1 && error.code === 'CLI_PROVIDER_RESPONSE_FREE_ERROR' && !inspected.nonempty) {
          recoveries.push({
            arm: job.arm,
            kind: job.kind,
            reason: 'Empty provider result; one same-packet technical recovery, no judgment to replace.',
            originalCall: reservation.call,
          });
          console.log(`${job.arm} ${job.kind} empty provider result; one bounded same-packet recovery`);
          continue;
        }
        write(path.join(outDir, 'stopped.json'), {
          error: error.message,
          scores,
          failures,
          recoveries,
          attemptsUsed,
          budget: budget.snapshot(),
        });
        throw error;
      }
    }
    write(path.join(outDir, `scores-after-${scores.length}.json`), { scores, failures, recoveries, attemptsUsed });
    console.log(`${scores.length}/${jobs.length} assessments available`);
  }
  const result = {
    judge: BENCHMARK_JUDGE,
    scores,
    failures,
    recoveries,
    attemptsUsed,
    plannedAssessments: jobs.length,
    assessmentContext,
    publicSourceContextByArm,
  };
  write(path.join(outDir, 'scores.json'), result);
  return result;
}

export async function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({ args: argv, options: { live: { type: 'boolean', default: false } } });
  const plan = loadContinuityPlan(ROOT, CONFIG);
  if (
    plan.total_attempt_ceiling !== 100 ||
    plan.generationCap !== 80 ||
    plan.arms.map((a) => `${a.id}/${a.mode}/${a.tutorMode}`).join(',') !==
      'C/ego_superego/direct,D/ego_superego/ego_superego'
  )
    throw new Error('unexpected two-arm superego design');
  const outDir = values.live
    ? path.join(ROOT, plan.output)
    : path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-bilateral-preflight-')), 'dry-run');
  fs.mkdirSync(outDir, { recursive: false });
  const provenance = {
    createdAt: new Date().toISOString(),
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    dirty: execFileSync('git', ['status', '--short'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    sourceRoot: ROOT,
    mock: !values.live,
    authorization: 'User: yes - go to 100',
    privateOnly: true,
    pushed: false,
    published: false,
  };
  const context = {
    ...buildRefusalPlan().assessmentContext,
    characterBrief: plan.characterBrief,
    profileId: 'goal_directed_hostile_refuser_continuity_v2',
  };
  write(path.join(outDir, 'plan.json'), { ...plan, assessmentContext: context, provenance });
  fs.copyFileSync(path.join(ROOT, plan.design), path.join(outDir, 'design.md'), fs.constants.COPYFILE_EXCL);
  const budget = continuityBudget(100, plan.id);
  const arms = [];
  let ownsServer = false;
  const servicePath = path.join(outDir, 'service.yaml');
  if (values.live) {
    const service = yaml.parse(fs.readFileSync(path.join(ROOT, plan.service_config), 'utf8'));
    service.workspace.path = plan.mtp_chat_root;
    service.timing.jsonl_path = path.join(outDir, 'service-timings.jsonl');
    fs.writeFileSync(servicePath, yaml.stringify(service), { flag: 'wx' });
  }
  try {
    try {
      if (values.live) {
        await manageServer(plan.mtp_chat_root, 'uncensored', 'start', servicePath);
        ownsServer = true;
        if ((await discoverLoadedModel(plan.base_url, { modelIdContains: plan.arms[0].model })) !== plan.arms[0].model)
          throw new Error('loaded Qwen checkpoint mismatch');
      }
      for (const arm of plan.arms) {
        const started = Date.now();
        await runContinuityArm({
          plan,
          arm,
          outDir: path.join(outDir, arm.id),
          budget,
          ...(!values.live
            ? {
                callModel: async ({ speaker, request }) => ({
                  text: JSON.stringify({
                    speech:
                      speaker === 'learner'
                        ? 'I want a workable handoff.'
                        : [
                            'I can own the report and explain one bounded connection.',
                            ...(request.proofPlan?.sources.map((s) => s.text) || []),
                          ].join(' '),
                    end_dialogue: false,
                    settled: [],
                    open: [],
                  }),
                  model: speaker === 'learner' ? arm.model : 'gpt-5.6-sol',
                  provider: speaker === 'learner' ? 'mlx-local' : 'codex',
                  latencyMs: 10,
                  usage: { inputTokens: 20, outputTokens: 20 },
                }),
                callReview: async () => ({
                  text: JSON.stringify({
                    role_fidelity: 'Preserve the assigned role.',
                    repetition: 'Consider the latest public move.',
                    next_move: 'Keep the grounded line if sound.',
                    evidence_boundary: 'Use only disclosed evidence.',
                  }),
                  provider: 'codex',
                  model: 'gpt-5.6-luna',
                  latencyMs: 10,
                  usage: { inputTokens: 20, outputTokens: 20 },
                }),
              }
            : {}),
        });
        arms.push(
          readBenchmarkArm({
            ...arm,
            path: path.join(outDir, arm.id, 'dialogue.json'),
            wallTimeMs: Date.now() - started,
          }),
        );
      }
    } finally {
      if (ownsServer) {
        await manageServer(plan.mtp_chat_root, 'uncensored', 'stop', servicePath);
        ownsServer = false;
      }
    }
    write(path.join(outDir, 'arms.json'), arms);
    const publicSourceContextByArm = Object.fromEntries(arms.map((arm) => [arm.id, deliveredSourceContext(plan, arm)]));
    write(
      path.join(outDir, 'judge-preflight.json'),
      buildBenchmarkJobs(arms, { extendedQuality: true, assessmentContext: context, publicSourceContextByArm }),
    );
    if (!values.live) {
      write(path.join(outDir, 'dry-run.json'), {
        mock: true,
        modelAttempts: 0,
        simulatedGenerationReservations: budget.snapshot().used,
        plannedGenerationMaximum: 80,
        plannedAssessments: 8,
        totalAttemptCeiling: 100,
      });
      console.log(JSON.stringify({ outDir, dryRun: true, modelAttempts: 0 }));
      return;
    }
    const evaluation = await scoreBilateralArms(arms, path.join(outDir, 'evaluation'), {
      budget,
      assessmentContext: context,
      publicSourceContextByArm,
    });
    const baseline = read(path.join(ROOT, plan.comparison_report));
    const result = {
      arms,
      evaluation,
      provenance: { ...provenance, budget: budget.snapshot(), modelActivity: 'inactive' },
      baseline,
      characterBrief: plan.characterBrief,
    };
    write(path.join(outDir, 'report-data.json'), result);
    const rendered = renderBilateralReport(result);
    fs.writeFileSync(path.join(outDir, 'report.html'), rendered.html, { flag: 'wx' });
    write(path.join(outDir, 'public-dialogues.json'), rendered.interchange);
    write(path.join(outDir, 'completed.json'), {
      budget: budget.snapshot(),
      assessments: evaluation.scores.length,
      judgeAttempts: evaluation.attemptsUsed,
      arms: arms.map((arm) => ({
        id: arm.id,
        exchanges: arm.snapshot.turns.length,
        disposition: arm.snapshot.disposition,
      })),
    });
    console.log(JSON.stringify({ outDir, attempts: budget.snapshot().used, assessments: evaluation.scores.length }));
  } catch (error) {
    write(path.join(outDir, 'stopped.json'), {
      error: error.message,
      budget: budget.snapshot(),
      armsCompleted: arms.length,
    });
    throw error;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href)
  main().catch((error) => {
    console.error(error.stack);
    process.exitCode = 1;
  });
