#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import yaml from 'yaml';
import {
  loadContinuityPlan,
  continuityBudget,
  runContinuityArm,
  buildContinuityRequest,
  parseContinuityReply,
} from '../services/localQwenRefusalContinuity.js';
import { manageServer, discoverLoadedModel } from './run-local-qwen-resistant-learner.js';
import { buildRefusalPlan } from './run-local-qwen-hostile-refusal.js';
import { readBenchmarkArm, scoreBenchmarkArms } from './score-local-qwen-resistant-learner-benchmark.js';
import { callAIWithCliBridge } from '../services/cliProviderBridge.js';
import { renderContinuityReport } from '../services/localQwenRefusalContinuityReport.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
export async function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      live: { type: 'boolean', default: false },
      continue: { type: 'boolean', default: false },
      from: { type: 'string' },
      output: { type: 'string' },
      config: { type: 'string' },
    },
  });
  const plan = loadContinuityPlan(ROOT, values.config);
  const sourceDir = path.resolve(ROOT, values.from || plan.output);
  const savedReplies = {};
  let priorAttempts = 0;
  if (values.continue) {
    const read = (name) => JSON.parse(fs.readFileSync(path.join(sourceDir, name), 'utf8'));
    const stop = read('stopped.json');
    if (stop.budget.limit !== 40 || stop.armsCompleted !== 0 || fs.existsSync(path.join(sourceDir, 'B')))
      throw new Error('continuation supports only a stopped normal-arm prefix before arm B');
    priorAttempts = stop.budget.used;
    const history = [{ role: 'assistant', content: plan.world.opening_frame.authored_text }];
    prefix: for (let turn = 1; turn <= plan.max_exchanges; turn++) {
      for (const speaker of ['learner', 'tutor']) {
        const key = `${turn}-${speaker}`;
        if (!fs.existsSync(path.join(sourceDir, `A/${key}.response.json`))) break prefix;
        const saved = {
          source: path.join(sourceDir, `A/${key}.response.json`),
          request: read(`A/${key}.request.json`),
          response: read(`A/${key}.response.json`),
        };
        if (saved.response.model !== (speaker === 'learner' ? plan.arms[0].model : 'gpt-5.6-sol'))
          throw new Error('saved reply route does not match the planned speaker');
        const parsed = parseContinuityReply(saved.response.text, history);
        history.push({ role: speaker === 'learner' ? 'user' : 'assistant', content: parsed.speech });
        savedReplies[key] = saved;
      }
    }
    if (priorAttempts !== Object.keys(savedReplies).length || priorAttempts < 1)
      throw new Error('saved prefix does not account for every prior attempt; cannot silently replace a reply');
  }
  // Reuse the existing instruments and judge context, changing only the assigned
  // character and observed horizon. No self-judge, rubric drift or legacy rescore.
  const context = {
    ...buildRefusalPlan().assessmentContext,
    characterBrief: plan.characterBrief,
    profileId: 'goal_directed_hostile_refuser_continuity_v2',
  };
  const outDir = values.live
    ? values.continue
      ? path.resolve(ROOT, values.output || path.join(sourceDir, 'continuation-v1'))
      : sourceDir
    : path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-continuity-')), 'dry-run');
  fs.mkdirSync(outDir, { recursive: false });
  const provenance = {
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    dirty: execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    totalAttemptCeiling: 40,
    createdAt: new Date().toISOString(),
    sourceRoot: ROOT,
    priorAttempts,
    savedReplySources: Object.values(savedReplies).map((saved) => saved.source),
    noteQuotationScope: 'prior_or_current_public_speech',
  };
  write(path.join(outDir, 'plan.json'), { ...plan, assessmentContext: context, provenance });
  const opening = [{ role: 'assistant', content: plan.world.opening_frame.authored_text }];
  for (const speaker of ['learner', 'tutor'])
    write(
      path.join(outDir, `${speaker}-preflight.json`),
      buildContinuityRequest({ plan, speaker, turn: 1, history: opening }),
    );
  if (plan.tutor_control === 'public_proof_dag') {
    let releasedPremiseIds = [];
    const proofPreflight = [];
    for (let turn = 1; turn <= plan.max_exchanges; turn++) {
      const request = buildContinuityRequest({ plan, speaker: 'tutor', turn, history: opening, releasedPremiseIds });
      proofPreflight.push(request);
      releasedPremiseIds = [...releasedPremiseIds, ...request.proofPlan.requiredReleases.map((row) => row.premise)];
    }
    write(path.join(outDir, 'proof-preflight.json'), proofPreflight);
  }
  fs.copyFileSync(path.join(ROOT, plan.design), path.join(outDir, 'design.md'), fs.constants.COPYFILE_EXCL);
  if (!values.live) return { outDir, dryRun: true, attempts: 0 };
  const service = yaml.parse(fs.readFileSync(path.join(ROOT, plan.service_config), 'utf8'));
  service.workspace.path = plan.mtp_chat_root;
  service.timing.jsonl_path = path.join(outDir, 'service-timings.jsonl');
  const servicePath = path.join(outDir, 'service.yaml');
  fs.writeFileSync(servicePath, yaml.stringify(service), { flag: 'wx' });
  const budget = continuityBudget(plan.total_attempt_ceiling, plan.id);
  if (priorAttempts) {
    write(
      path.join(outDir, 'prior-attempts.json'),
      Object.entries(savedReplies).map(([key, saved]) => {
        const [turn, speaker] = key.split('-');
        const imported = budget.reserve({
          role: speaker === 'learner' ? 'tutor_stub_auto_learner' : 'tutor_stub_tutor',
          turn: Number(turn),
        });
        return {
          ...imported,
          source: saved.source,
          alreadyDispatched: true,
          note: 'Exact saved reply, no replacement; original stop records remain unchanged.',
        };
      }),
    );
  }
  const arms = [];
  try {
    for (const arm of plan.arms) {
      const started = Date.now();
      let ownsServer = false;
      try {
        await manageServer(plan.mtp_chat_root, arm.profile, 'start', servicePath);
        ownsServer = true;
        const loaded = await discoverLoadedModel(plan.base_url, { modelIdContains: arm.model });
        if (loaded !== arm.model) throw new Error('loaded model does not exactly match the planned arm');
        await runContinuityArm({
          plan,
          arm,
          outDir: path.join(outDir, arm.id),
          budget,
          savedReplies: arm.id === 'A' ? savedReplies : {},
        });
      } finally {
        if (ownsServer) await manageServer(plan.mtp_chat_root, arm.profile, 'stop', servicePath);
      }
      arms.push(
        readBenchmarkArm({
          ...arm,
          path: path.join(outDir, arm.id, 'dialogue.json'),
          wallTimeMs: Date.now() - started,
        }),
      );
    }
    write(path.join(outDir, 'arms.json'), arms);
    const evaluation = await scoreBenchmarkArms(arms, path.join(outDir, 'evaluation'), {
      ceiling: 8,
      extendedQuality: true,
      allowOneBasedIndices: true,
      assessmentContext: context,
      callJudge: async (...args) => {
        const reservation = budget.reserve({ role: args[3] });
        fs.appendFileSync(path.join(outDir, 'attempts.jsonl'), `${JSON.stringify(reservation)}\n`);
        console.log(`Opus assessment started; ${reservation.call}/${reservation.limit} total attempts reserved`);
        return callAIWithCliBridge(...args);
      },
    });
    const baselinePath = path.join(
      ROOT,
      plan.comparison_report ||
        '.tutor-stub-traces/qwen-hostile-refusal-comparison-v1/final-four-v1/completion/report-v2/report-data.json',
    );
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    const result = {
      arms,
      evaluation,
      provenance: { ...provenance, budget: budget.snapshot() },
      characterBrief: plan.characterBrief,
      proofControl: plan.tutor_control === 'public_proof_dag',
      comparisonLabel: plan.comparison_report
        ? 'Compared with continuity-v2, without proof steering'
        : 'Compared with the original eight-exchange baseline',
      corrections: [
        ...(plan.tutor_control === 'public_proof_dag'
          ? [
              'The earlier learner-role smoke disabled learner-DAG analysis too; it retained guarded tutor composition and scheduled clues. This run adds public-evidence proof control, not an undisclosed analysis model.',
              'The existing Horn chainer, world scaffold and source renderer now supply a required inquiry action. Due evidence must be delivered exactly once before it advances the public ledger.',
              'Sol must connect the available evidence to the causal question while respecting refusal; a repair-service promise alone no longer satisfies the tutor brief.',
              'The private graph is not passed to either speaker. Public proof sufficiency is separate from learner understanding, which remains unassessed until independent judging.',
            ]
          : []),
        'Alex seeks a handoff with responsibility, timing and follow-up; walking out does not itself resolve the repair goal.',
        'Explicit speaker-role instructions replace the generic response instruction. No forced turn count or recurring refusal cue.',
        'Both routes request the same structured output, with spoken character performance before private notes. Format enforcement is not evidence of faithful acting.',
        'Sol leaves an offer open for Alex to accept or reject; an offer alone is not agreed closure.',
        'The stopped v1 run remains unchanged: three attempts, a valid normal-Qwen exit and an abliterated role/format failure. It supplies no paired quality scores.',
        ...(priorAttempts
          ? [
              'The first normal-Qwen reply and its original request were reused byte-for-byte after the user approved notes citing current speech. It remains one attempt in the same 40-attempt ceiling; no replacement was generated.',
              'That first reply was generated under the earlier note instruction. All subsequent requests allow current-speech quotations symmetrically. Wall time measures this continuation only, excluding all imported calls and their earlier sessions.',
              `${priorAttempts} existing replies were imported without new calls. Curly and straight apostrophes are equivalent for quotation matching; each nonliteral match is audited, with raw wording unchanged.`,
            ]
          : []),
      ],
      baseline,
    };
    write(path.join(outDir, 'report-data.json'), result);
    const report = renderContinuityReport(result);
    fs.writeFileSync(path.join(outDir, 'report.html'), report.html, { flag: 'wx' });
    write(path.join(outDir, 'public-dialogues.json'), report.interchange);
    write(path.join(outDir, 'completed.json'), {
      budget: budget.snapshot(),
      arms: arms.map((a) => ({ id: a.id, exchanges: a.snapshot.turns.length, disposition: a.snapshot.disposition })),
      assessments: evaluation.scores.length,
    });
    return { outDir, attempts: budget.snapshot().used };
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
  main()
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      console.error(error.stack);
      process.exitCode = 1;
    });
