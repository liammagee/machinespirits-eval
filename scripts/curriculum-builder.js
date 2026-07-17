#!/usr/bin/env node

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs as parseNodeArgs } from 'node:util';
import yaml from 'yaml';

import { call as callAI } from '../tutor-core/services/unifiedAIProviderService.js';
import { callAIWithCliBridge, isCliProvider, normalizeCliEffort } from '../services/cliProviderBridge.js';
import {
  CURRICULUM_SCHEMA,
  DEFAULT_CURRICULUM_BUILDER_MODEL,
  buildCurriculumFromBrief,
  compileCurriculumBuilderBundle,
  curriculumBuilderDraftPrompt,
  curriculumBuilderOutputPaths,
  curriculumBuilderSlug,
  curriculumReferencesFromMaterials,
  loadCurriculumSourceMaterials,
  parseCurriculumBuilderDraftResponse,
  renderCurriculumBuilderReport,
  validateCurriculumBuilderCurriculum,
} from '../services/curriculum/curriculumBuilder.js';
import { writeYaml } from '../services/curriculum/curriculumCompiler.js';
import { resolveModel } from '../services/evalConfigLoader.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function usage() {
  return `Curriculum Builder — author a prerequisite DAG, source ledger, worlds, and dramas

Usage:
  npm run curriculum:build
  npm run curriculum:build -- --brief curriculum/my-course.brief.yaml
  npm run curriculum:build -- --brief curriculum/my-course.brief.yaml --generate --source https://example.org/guide
  npm run curriculum:build -- --brief curriculum/my-course.curriculum.yaml --check

Inputs:
  --brief <path>           YAML or JSON builder brief; canonical curriculum YAML is also accepted
  --source <url>           fetch an HTML/text reference (repeatable)
  --source-file <path>     ingest a local HTML/text/Markdown reference (repeatable)
  --interactive            prompt for missing course/module fields (default with no --brief)
  --no-interactive         fail instead of prompting

Model-assisted drafting:
  --generate               draft/refine modules from the brief and source extracts
  --model <provider.model> drafting model (default: ${DEFAULT_CURRICULUM_BUILDER_MODEL})
  --effort <level>         CLI effort: low|medium|high|xhigh|max|config (default: low)
  --module-count <n>       requested module count for generated or interactive drafts

Outputs:
  --out <path>             canonical YAML (default: curriculum/<id>.curriculum.yaml)
  --no-compile             write only the canonical curriculum and builder report
  --rhetorical             also compile rhetorical plans and rhetorical dramas
  --report <path>          override the Markdown build report path
  --force                  overwrite existing output artifacts

Safety and inspection:
  --dry-run                validate/preview without writing; never calls a model
  --check                  validate without writing
  --help, -h               show this help

The builder always validates runtime-ready module evidence and rejects cycles.
World specs constrain tutor action; they do not evaluate learning outcomes.`;
}

export function parseArgs(argv) {
  const { values } = parseNodeArgs({
    args: argv,
    strict: true,
    allowPositionals: false,
    options: {
      brief: { type: 'string' },
      source: { type: 'string', multiple: true, default: [] },
      'source-file': { type: 'string', multiple: true, default: [] },
      interactive: { type: 'boolean' },
      'no-interactive': { type: 'boolean', default: false },
      generate: { type: 'boolean', default: false },
      model: { type: 'string', default: DEFAULT_CURRICULUM_BUILDER_MODEL },
      effort: { type: 'string', default: 'low' },
      'module-count': { type: 'string' },
      out: { type: 'string' },
      'no-compile': { type: 'boolean', default: false },
      rhetorical: { type: 'boolean', default: false },
      report: { type: 'string' },
      force: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      check: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  const moduleCount = values['module-count'] == null ? null : Number.parseInt(values['module-count'], 10);
  if (moduleCount != null && (!Number.isInteger(moduleCount) || moduleCount <= 0)) {
    throw new Error('--module-count must be a positive integer');
  }
  return {
    brief: values.brief ? path.resolve(values.brief) : null,
    sources: values.source,
    sourceFiles: values['source-file'].map((filePath) => path.resolve(filePath)),
    interactive: values.interactive ?? (!values.brief && !values['no-interactive'] && input.isTTY && output.isTTY),
    generate: values.generate,
    model: values.model,
    effort: normalizeCliEffort(values.effort),
    moduleCount,
    out: values.out ? path.resolve(values.out) : null,
    compile: !values['no-compile'],
    rhetorical: values.rhetorical,
    report: values.report ? path.resolve(values.report) : null,
    force: values.force,
    dryRun: values['dry-run'],
    check: values.check,
    help: values.help,
  };
}

function loadStructuredFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return /\.json$/iu.test(filePath) ? JSON.parse(raw) : yaml.parse(raw);
}

function splitList(value) {
  return String(value || '')
    .split(/[;,]/u)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function ask(rl, prompt, fallback = '') {
  const suffix = fallback ? ` [${fallback}]` : '';
  const answer = (await rl.question(`${prompt}${suffix} > `)).trim();
  return answer || fallback;
}

async function collectInteractiveBrief(args, initial = {}) {
  const rl = readline.createInterface({ input, output });
  try {
    console.log('\nCurriculum builder · course → prerequisite DAG → worlds → dramas');
    console.log('Leave a field blank to accept the value in brackets. Separate list items with semicolons.\n');
    const title = await ask(rl, 'Course title', initial.title || 'Evidence and Reasoning');
    const id = await ask(rl, 'Curriculum id', initial.id || `${curriculumBuilderSlug(title)}_v1`);
    const discipline = await ask(rl, 'Discipline slug', initial.discipline || id.replace(/_v\d+$/u, ''));
    const audience = await ask(rl, 'Audience', initial.audience || 'Adult and early undergraduate learners');
    const delivery = await ask(rl, 'Delivery', initial.delivery || 'Adaptive tutor-supported course');
    const courseGoal = await ask(rl, 'Course-level goal', initial.course_goal || initial.goal || '');
    const moduleCount = args.moduleCount || Number.parseInt(await ask(rl, 'Number of modules', '3'), 10);
    if (!Number.isInteger(moduleCount) || moduleCount <= 0) throw new Error('module count must be positive');
    const webSources = splitList(await ask(rl, 'Optional web source URLs', args.sources.join('; ')));
    const localSources = splitList(await ask(rl, 'Optional local source files', args.sourceFiles.join('; ')));
    args.sources = webSources;
    args.sourceFiles = localSources.map((filePath) => path.resolve(filePath));

    const brief = {
      ...initial,
      title,
      id,
      discipline,
      audience,
      delivery,
      course_goal: courseGoal,
      module_count: moduleCount,
      module_prefix: initial.module_prefix || discipline.slice(0, 3).toUpperCase(),
      sequential_prerequisites: initial.sequential_prerequisites ?? true,
    };
    if (args.generate) return brief;

    const modules = [];
    for (let index = 0; index < moduleCount; index += 1) {
      const defaultId = `${brief.module_prefix}${index + 1}`;
      console.log(`\nModule ${index + 1}/${moduleCount}`);
      const moduleId = await ask(rl, '  id', defaultId);
      const titleValue = await ask(rl, '  title');
      const essentialQuestion = await ask(rl, '  essential question');
      const artifact = await ask(rl, '  learner-authored artifact');
      const verifier = await ask(rl, '  primary observable verifier');
      const knowledgeComponents = splitList(await ask(rl, '  knowledge components'));
      const tasks = splitList(await ask(rl, '  canonical tasks'));
      const misconceptions = splitList(await ask(rl, '  misconception signatures'));
      const masteryGate = await ask(rl, '  mastery gate');
      const transferChallenge = await ask(rl, '  transfer challenge');
      const defaultPrerequisites = index > 0 ? modules[index - 1].id : '';
      const prerequisiteIds = splitList(await ask(rl, '  prerequisite module ids', defaultPrerequisites));
      modules.push({
        id: moduleId,
        title: titleValue,
        essential_question: essentialQuestion,
        main_artifact: artifact,
        primary_verifier: verifier,
        knowledge_components: knowledgeComponents,
        canonical_tasks: tasks,
        verifiers: [verifier],
        misconception_signatures: misconceptions,
        mastery_gate: masteryGate,
        transfer_challenge: transferChallenge,
        prerequisite_ids: prerequisiteIds,
      });
    }
    brief.sequential_prerequisites = false;
    brief.modules = modules;
    return brief;
  } finally {
    rl.close();
  }
}

async function callDraftingModel({ modelRef, effort, prompt }) {
  const resolved = resolveModel(modelRef);
  if (!isCliProvider(resolved.provider) && !resolved.isConfigured) {
    throw new Error(`model ${modelRef} is not configured`);
  }
  return await callAIWithCliBridge(
    { provider: resolved.provider, model: resolved.model },
    'You are a curriculum architect. Produce a rigorous, observable, source-traceable course graph. Return JSON only.',
    prompt,
    'curriculum_builder_draft',
    {
      effort,
      fallbackCallAI: async (agentConfig, systemPrompt, userPrompt) => {
        const response = await callAI({
          provider: agentConfig.provider,
          model: agentConfig.model,
          systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
          preset: 'socratic',
          config: { temperature: 0.2, maxTokens: 12_000 },
        });
        return {
          text: response.content,
          provider: response.provider,
          model: response.model,
          latencyMs: response.latencyMs,
          usage: response.usage,
        };
      },
    },
  );
}

function portableMaterials(materials) {
  return materials.map((material) => ({
    ...material,
    ...(material.path && material.path.startsWith(`${ROOT}${path.sep}`)
      ? { path: path.relative(ROOT, material.path) }
      : {}),
  }));
}

function ensureWritable(paths, { force, check, dryRun }) {
  if (force || check || dryRun) return;
  for (const filePath of paths) {
    if (filePath && fs.existsSync(filePath)) {
      throw new Error(`refusing to overwrite ${path.relative(ROOT, filePath)}; pass --force`);
    }
  }
}

function displayPath(filePath) {
  return filePath.startsWith(`${ROOT}${path.sep}`) ? path.relative(ROOT, filePath) : filePath;
}

export async function buildCurriculum(args) {
  if (args.dryRun && args.generate) {
    return {
      dryRun: true,
      planned: {
        brief: args.brief ? displayPath(args.brief) : 'interactive',
        model: args.model,
        moduleCount: args.moduleCount,
        webSources: args.sources,
        localSources: args.sourceFiles.map(displayPath),
        compile: args.compile,
        rhetorical: args.rhetorical,
      },
    };
  }

  let brief = args.brief ? loadStructuredFile(args.brief) : {};
  const canonicalInput = brief?.schema_version === CURRICULUM_SCHEMA;
  if (args.interactive && !canonicalInput) brief = await collectInteractiveBrief(args, brief);
  if (!canonicalInput && !brief?.title) {
    throw new Error('supply --brief, or run interactively in a TTY');
  }

  console.log(`sources > ${args.sources.length} web, ${args.sourceFiles.length} local`);
  const materials = portableMaterials(
    await loadCurriculumSourceMaterials({ urls: args.sources, files: args.sourceFiles }),
  );
  const references = curriculumReferencesFromMaterials(materials);

  let generatedWithModel = null;
  if (!canonicalInput && args.generate) {
    console.log(`drafting > ${args.model} · ${args.effort || 'configured'} effort`);
    const response = await callDraftingModel({
      modelRef: args.model,
      effort: args.effort,
      prompt: curriculumBuilderDraftPrompt({ brief, materials, moduleCount: args.moduleCount }),
    });
    const generated = parseCurriculumBuilderDraftResponse(response.text);
    brief = {
      ...generated,
      ...Object.fromEntries(Object.entries(brief).filter(([, value]) => value != null && value !== '')),
      modules: generated.modules,
      associations: generated.associations || brief.associations,
    };
    generatedWithModel = {
      requested: args.model,
      provider: response.provider,
      model: response.model,
      effort: args.effort,
    };
  }

  const curriculum = canonicalInput
    ? brief
    : buildCurriculumFromBrief(brief, {
        references,
        briefPath: args.brief ? displayPath(args.brief) : null,
        generatedWithModel,
      });
  if (canonicalInput && references.length) {
    curriculum.references = [...(curriculum.references || []), ...references];
  }
  const validation = validateCurriculumBuilderCurriculum(curriculum, args.brief || '<interactive>');
  const defaultOut = path.join(ROOT, 'curriculum', `${curriculumBuilderSlug(curriculum.id)}.curriculum.yaml`);
  const outputPaths = curriculumBuilderOutputPaths(args.out || defaultOut);
  if (args.report) outputPaths.report = args.report;
  const bundle = args.compile ? compileCurriculumBuilderBundle(curriculum, { rhetorical: args.rhetorical }) : null;
  const plannedPaths = [outputPaths.curriculum, outputPaths.report];
  if (bundle) plannedPaths.push(outputPaths.worlds, outputPaths.dramas);
  if (bundle?.rhetoricalPlans) plannedPaths.push(outputPaths.rhetoricalPlans, outputPaths.rhetoricalDramas);
  ensureWritable(plannedPaths, args);
  const report = renderCurriculumBuilderReport({
    curriculum,
    validation,
    outputs: Object.fromEntries(Object.entries(outputPaths).map(([key, value]) => [key, displayPath(value)])),
    compiled: Boolean(bundle),
  });

  if (!args.check && !args.dryRun) {
    writeYaml(outputPaths.curriculum, curriculum);
    if (bundle) {
      writeYaml(outputPaths.worlds, bundle.worlds);
      writeYaml(outputPaths.dramas, bundle.dramas);
      if (bundle.rhetoricalPlans) writeYaml(outputPaths.rhetoricalPlans, bundle.rhetoricalPlans);
      if (bundle.rhetoricalDramas) writeYaml(outputPaths.rhetoricalDramas, bundle.rhetoricalDramas);
    }
    fs.mkdirSync(path.dirname(outputPaths.report), { recursive: true });
    fs.writeFileSync(outputPaths.report, `${report}\n`, 'utf8');
  }
  return { curriculum, validation, bundle, outputPaths, report, dryRun: args.dryRun, check: args.check };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const result = await buildCurriculum(args);
  if (result.dryRun && result.planned) {
    console.log('dry run > no model calls or files written');
    console.log(yaml.stringify(result.planned));
    return;
  }
  const verb = result.check ? 'validated' : result.dryRun ? 'previewed' : 'built';
  console.log(
    `${verb} > ${result.curriculum.title} · ${result.validation.moduleCount} modules · ${result.validation.knowledgeComponentCount} knowledge components`,
  );
  console.log(`DAG > ${result.validation.topologicalOrder.join(' -> ')}`);
  if (result.dryRun) console.log(`\n${result.report}`);
  if (!result.check && !result.dryRun) {
    console.log(`curriculum > ${displayPath(result.outputPaths.curriculum)}`);
    if (result.bundle) {
      console.log(`worlds > ${displayPath(result.outputPaths.worlds)}`);
      console.log(`dramas > ${displayPath(result.outputPaths.dramas)}`);
      console.log(
        `next > node scripts/generate-pedagogical-dramas.js --dry-run --spec ${displayPath(result.outputPaths.dramas)} --only D_${result.curriculum.modules[0].id}_CURRICULUM --max-turns 2`,
      );
    }
    console.log(`report > ${displayPath(result.outputPaths.report)}`);
  }
  console.log('boundary > compiled worlds constrain action; learner/verifier evidence must still evaluate learning');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}
