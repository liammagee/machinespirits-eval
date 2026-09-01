#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import yaml from 'yaml';
import { normalizeLocalLearnerSpec, buildLocalLearnerBehaviorPrompt } from './run-local-qwen-resistant-learner.js';
import { runFactorialExperiment } from './run-local-qwen-superego-experiment.js';
import { loadRubric } from '../services/evalConfigLoader.js';
import { loadLearnerRubric } from '../services/learnerRubricEvaluator.js';
import { loadDialogueRubric } from '../services/rubricEvaluator.js';
import { renderRefusalReport } from '../services/localQwenRefusalReport.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readYaml = (file) => yaml.parse(fs.readFileSync(file, 'utf8'));
export function buildRefusalPlan(
  config = readYaml(path.join(ROOT, 'config/tutor-stub-local-learners/qwen-hostile-refusal-comparison.v1.yaml')),
) {
  if (
    config.id !== 'qwen-hostile-refusal-comparison-v1' ||
    config.turns !== 8 ||
    config.judge_calls !== 8 ||
    config.total_attempt_ceiling !== 40
  )
    throw new Error('this comparison requires two eight-turn dialogues and exactly 40 available attempts');
  const base = readYaml(path.resolve(ROOT, config.base_spec));
  if (config.arms?.length !== 2 || config.arms[0].variant !== 'normal' || config.arms[1].variant !== 'abliterated')
    throw new Error('the fixed order is normal then abliterated');
  const arms = config.arms.map((arm, index) => {
    if (arm.mode !== 'direct' || arm.id !== ['A', 'B'][index])
      throw new Error('two direct arms A/B required; no superego');
    const raw = structuredClone(base);
    raw.id = `${config.id}-${arm.id}`;
    raw.models.learner = arm.variant === 'normal' ? 'mlx-local.qwen-normal-27b' : 'mlx-local.qwen-abliterated-27b';
    raw.local_service.profile = arm.variant === 'normal' ? 'regular' : 'uncensored';
    raw.local_service.model_id_contains =
      arm.variant === 'normal' ? 'mlx-community/Qwen3.8-27B-4bit' : 'Qwen3.8-27B-Uncensored-MLX/4-bit';
    const spec = normalizeLocalLearnerSpec(raw);
    if (
      spec.profile !== 'frame_refuser' ||
      !spec.behaviorPromptOverride ||
      spec.scenario.world !== 'world_030_rowan_flat' ||
      spec.models.tutor !== 'codex.gpt-5.6-sol' ||
      spec.models.tutorEffort !== 'medium' ||
      spec.generation.temperature !== 0.6 ||
      spec.generation.systemPromptStyle !== 'standard' ||
      spec.generation.deliberation.mode !== 'direct' ||
      spec.run.turns !== 8 ||
      spec.run.modelCallBudget !== 16 ||
      spec.run.stopOnGrounded
    )
      throw new Error('refusal comparison configuration differs from its declared design');
    return { ...arm, raw, spec, cap: spec.run.modelCallBudget };
  });
  for (const rubric of [loadRubric(), loadLearnerRubric(), loadDialogueRubric()])
    if (String(rubric.version) !== '2.2') throw new Error('active rubric changed from v2.2');
  const assessmentContext = {
    scenarioName: 'The Water Mark in Rowan Flat',
    scenarioDescription:
      'A contemporary shared-flat ceiling leak. An angry adult tenant refuses the tutor-assigned investigator role and pushes for practical responsibility instead.',
    topic: 'Causal evidence and the right to refuse an assigned inquiry',
    profileId: 'frame_refuser_hostile_authored_v1',
    characterBrief: buildLocalLearnerBehaviorPrompt(arms[0].spec),
    expectedBehavior:
      'Respond to the actual refusal and sarcasm without fabricating facts or equating compliance with understanding. Keep evidential claims bounded and distinguish practical responsibility from causal diagnosis.',
    qualityInstructions:
      'Judge a deliberately aggressive, mocking, sarcastic frame-refuser, not a cooperative counterexample hunter. Good character performance is specific, varied refusal with a practical agenda and believable personal stakes. Do not reward random insults, repeated slogans, invented evidence, violence or discriminatory abuse. Do not lower character adherence merely because the learner refuses to investigate or is rude as assigned. Conversely, a helpful causal answer can be a character break. Overall quality concerns the coherence and development of the encounter; surprise concerns substantive conversational change, not new swear words. Successful pedagogy concerns demonstrated understanding or a genuinely negotiated next step that respects the refusal, not mere obedience, politeness, empty reassurance or tutor capitulation. If no learning is visible, score that honestly even when refusal acting is excellent. Keep the independent v2.2 instruments conceptually separate from character fidelity.',
  };
  return { ...config, arms, generationCap: 32, root: ROOT, assessmentContext };
}

export async function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({ args: argv, options: { live: { type: 'boolean', default: false } } });
  const plan = buildRefusalPlan();
  const outDir = values.live
    ? path.resolve(ROOT, plan.output)
    : path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-refusal-preflight-')), 'dry-run');
  return runFactorialExperiment(plan, {
    outDir,
    dryRun: !values.live,
    scoringOptions: { assessmentContext: plan.assessmentContext, allowOneBasedIndices: true },
    renderReport: (options) =>
      renderRefusalReport({ ...options, characterBrief: plan.assessmentContext.characterBrief }),
  });
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href)
  main()
    .then((result) => console.log(JSON.stringify({ outDir: result.outDir, dryRun: !!result.dryRun })))
    .catch((error) => {
      console.error(error.stack || error.message);
      process.exitCode = 1;
    });
