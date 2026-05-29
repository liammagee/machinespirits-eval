#!/usr/bin/env node
/**
 * Interactive front door for the Phase-2 teaching-drama generator.
 *
 * This script asks for a single teaching situation, writes a compatible
 * poetics-calibration drama spec, then delegates generation to
 * scripts/generate-pedagogical-dramas.js. The delegated generator remains the
 * source of truth for bilateral ego/superego traces, Director scene cards,
 * public/full transcript separation, and Codex/Claude role routing.
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUT_ROOT = path.join(ROOT, 'exports', 'drama-generator');

const PERSONAS = new Set([
  'confused_novice',
  'eager_explorer',
  'focused_achiever',
  'struggling_anxious',
  'adversarial_tester',
]);
const CONDITIONS = new Set(['base', 'recognition']);
const REVISIT_POLICIES = new Set(['none', 'anchor', 'revoice', 'reconsider', 'reframe']);
const SPEAKERS = new Set(['learner', 'tutor', 'director']);
const GENERATORS = new Set(['codex', 'claude', 'gemini']);
// claude CLI reasoning tiers (passed through to generate-pedagogical-dramas.js
// --effort; claude backend only).
const EFFORT_LEVELS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);

const DEFAULT_ANSWERS = {
  title: 'Resistance In The Room',
  discipline: 'biology',
  learnerLevel: 'introductory undergraduate',
  topic: 'antibiotic resistance as bacterial population change, not the patient body getting used to medicine',
  scenarioName: 'Who becomes resistant?',
  learnerStart:
    'The learner thinks antibiotic resistance means the same patient body gets used to the medicine, so the medicine stops working for that person.',
  misframing: 'the body gets used to the antibiotic',
  reframe: 'resistance is re-read as bacteria changing under selection pressure',
  tutorPersonality: 'concrete, exact, not soothing by default; starts from the agent of change',
  learnerPersonality: 'tentative but practical; willing to revise, not polished or constantly self-narrating',
  directorPersonality: 'quietly disruptive; uses scene pressure and visible objects rather than explanatory narration',
  sceneSetting: 'a clinic training room during a short break, with a patient-information leaflet on the table',
  relationship: 'a trainee and a tutor who have a working rapport but not a settled shared vocabulary',
  stakes: 'the learner has to explain the leaflet accurately to someone else later that day',
  condition: 'recognition',
  persona: 'confused_novice',
  openingSpeaker: 'learner',
  endingSpeaker: 'director',
  revisitPolicy: 'reframe',
};

function parseArgs(argv) {
  const args = {
    answers: {},
    outRoot: DEFAULT_OUT_ROOT,
    id: null,
    generator: 'codex',
    model: 'opus',
    effort: null,
    maxTurns: 3,
    roleMap: null,
    answersFile: null,
    templatePath: null,
    nonInteractive: false,
    mock: false,
    force: false,
    dryRun: false,
    specOnly: false,
    printCommand: false,
    json: false,
  };

  const setAnswer = (key, value) => {
    args.answers[key] = value;
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--help' || token === '-h') {
      args.help = true;
    } else if (token === '--non-interactive') {
      args.nonInteractive = true;
    } else if (token === '--mock') {
      args.mock = true;
    } else if (token === '--force') {
      args.force = true;
    } else if (token === '--dry-run') {
      args.dryRun = true;
    } else if (token === '--spec-only') {
      args.specOnly = true;
    } else if (token === '--print-command') {
      args.printCommand = true;
    } else if (token === '--json') {
      args.json = true;
    } else if (token === '--out-root') {
      args.outRoot = path.resolve(argv[++i]);
    } else if (token === '--id') {
      args.id = argv[++i];
    } else if (token === '--generator') {
      args.generator = argv[++i];
    } else if (token === '--model') {
      args.model = argv[++i];
    } else if (token === '--effort') {
      args.effort = argv[++i];
    } else if (token === '--max-turns') {
      args.maxTurns = Number.parseInt(argv[++i], 10);
    } else if (token === '--role-map') {
      args.roleMap = argv[++i];
    } else if (token === '--answers') {
      args.answersFile = path.resolve(argv[++i]);
    } else if (token === '--write-template') {
      args.templatePath = path.resolve(argv[++i]);
    } else if (token === '--title') {
      setAnswer('title', argv[++i]);
    } else if (token === '--discipline') {
      setAnswer('discipline', argv[++i]);
    } else if (token === '--learner-level') {
      setAnswer('learnerLevel', argv[++i]);
    } else if (token === '--topic') {
      setAnswer('topic', argv[++i]);
    } else if (token === '--scenario') {
      setAnswer('scenarioName', argv[++i]);
    } else if (token === '--learner-start') {
      setAnswer('learnerStart', argv[++i]);
    } else if (token === '--misframing') {
      setAnswer('misframing', argv[++i]);
    } else if (token === '--reframe') {
      setAnswer('reframe', argv[++i]);
    } else if (token === '--tutor-personality') {
      setAnswer('tutorPersonality', argv[++i]);
    } else if (token === '--learner-personality') {
      setAnswer('learnerPersonality', argv[++i]);
    } else if (token === '--director-personality') {
      setAnswer('directorPersonality', argv[++i]);
    } else if (token === '--scene-setting') {
      setAnswer('sceneSetting', argv[++i]);
    } else if (token === '--relationship') {
      setAnswer('relationship', argv[++i]);
    } else if (token === '--stakes') {
      setAnswer('stakes', argv[++i]);
    } else if (token === '--condition') {
      setAnswer('condition', argv[++i]);
    } else if (token === '--persona') {
      setAnswer('persona', argv[++i]);
    } else if (token === '--opening-speaker') {
      setAnswer('openingSpeaker', argv[++i]);
    } else if (token === '--ending-speaker') {
      setAnswer('endingSpeaker', argv[++i]);
    } else if (token === '--revisit-policy') {
      setAnswer('revisitPolicy', argv[++i]);
    } else {
      throw new Error(`unknown arg: ${token}`);
    }
  }

  if (args.answersFile) {
    args.answers = { ...loadAnswersFile(args.answersFile), ...args.answers };
  }
  validateArgs(args);
  return args;
}

function validateArgs(args) {
  if (!GENERATORS.has(args.generator)) throw new Error('--generator must be codex|claude|gemini');
  if (args.effort && !EFFORT_LEVELS.has(args.effort)) throw new Error('--effort must be low|medium|high|xhigh|max');
  if (!Number.isInteger(args.maxTurns) || args.maxTurns < 1) throw new Error('--max-turns must be a positive integer');
  if (args.answers.condition && !CONDITIONS.has(args.answers.condition)) {
    throw new Error('--condition must be base|recognition');
  }
  if (args.answers.persona && !PERSONAS.has(args.answers.persona)) {
    throw new Error(`--persona must be one of: ${[...PERSONAS].join(', ')}`);
  }
  if (args.answers.revisitPolicy && !REVISIT_POLICIES.has(args.answers.revisitPolicy)) {
    throw new Error('--revisit-policy must be none|anchor|revoice|reconsider|reframe');
  }
  for (const key of ['openingSpeaker', 'endingSpeaker']) {
    if (args.answers[key] && !SPEAKERS.has(args.answers[key])) {
      throw new Error(`--${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)} must be learner|tutor|director`);
    }
  }
  if (args.id && !/^[a-zA-Z0-9._-]+$/.test(args.id)) throw new Error('--id must be path-safe');
}

function helpText() {
  return `Usage:
  node scripts/drama-generator.js
  node scripts/drama-generator.js --mock --non-interactive --out-root /tmp/drama-generator --id smoke --force
  node scripts/drama-generator.js --write-template exports/drama-generator/answers.yaml
  node scripts/drama-generator.js --answers answers.yaml --generator codex --force
  node scripts/drama-generator.js --generator codex --revisit-policy reframe --max-turns 3
  node scripts/drama-generator.js --generator claude --model claude-opus-4-8 --effort xhigh --non-interactive --force

Generators: codex (CODEX_REASONING_EFFORT, default xhigh) · claude (--model / --effort
low|medium|high|xhigh|max) · gemini (agy/gemini-3.5-flash; no model/effort selector).

Questions collected: discipline, learner level, topic/scenario, learner start state,
misframing, desired reframe, tutor personality, learner personality, director
personality, scene, stakes, condition, persona, and speaker order.

Outputs:
  default root: exports/drama-generator/<id> (ignored by git)
  <out-root>/<id>/spec.yaml
  <out-root>/<id>/sample/T01.txt
  <out-root>/<id>/transcripts/T01.full.md
  <out-root>/<id>/key.yaml
  <out-root>/<id>/deliberation/T01.json`;
}

function loadAnswersFile(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`--answers file not found: ${filePath}`);
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = filePath.endsWith('.json') ? JSON.parse(raw) : yaml.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('--answers must contain a YAML/JSON object');
  }
  return parsed.answers && typeof parsed.answers === 'object' ? parsed.answers : parsed;
}

function writeAnswersTemplate(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    yaml.stringify({
      note: 'Edit these values, then run: npm run drama:generate -- --answers <this-file> --generator codex --force',
      answers: DEFAULT_ANSWERS,
    }),
    'utf8',
  );
}

function slugify(value, fallback = 'drama') {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || fallback;
}

function timestampId(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
}

function runIdFor(args, answers, date = new Date()) {
  if (args.id) return args.id;
  return `${timestampId(date)}-${slugify(answers.scenarioName || answers.title)}`;
}

function answerValue(answers, key) {
  const value = answers[key];
  return value == null ? '' : String(value).trim();
}

async function ask(rl, prompt, defaultValue) {
  const suffix = defaultValue ? ` [${defaultValue}]` : '';
  const value = (await rl.question(`${prompt}${suffix}: `)).trim();
  return value || defaultValue || '';
}

async function collectInteractiveAnswers(seedAnswers = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answers = { ...DEFAULT_ANSWERS, ...seedAnswers };
    answers.title = await ask(rl, 'Short title', answers.title);
    answers.discipline = await ask(rl, 'Discipline', answers.discipline);
    answers.learnerLevel = await ask(rl, 'Learner level', answers.learnerLevel);
    answers.topic = await ask(rl, 'Topic or concept', answers.topic);
    answers.scenarioName = await ask(rl, 'Scenario name', answers.scenarioName);
    answers.learnerStart = await ask(rl, 'Learner starting state or misconception', answers.learnerStart);
    answers.misframing = await ask(rl, 'Earlier learner misframing to preserve as the anchor', answers.misframing);
    answers.reframe = await ask(rl, 'Later reframe or changed reading you want made possible', answers.reframe);
    answers.tutorPersonality = await ask(rl, 'Tutor personality', answers.tutorPersonality);
    answers.learnerPersonality = await ask(rl, 'Learner personality', answers.learnerPersonality);
    answers.directorPersonality = await ask(rl, 'Director personality', answers.directorPersonality);
    answers.sceneSetting = await ask(rl, 'Scene setting', answers.sceneSetting);
    answers.relationship = await ask(rl, 'Tutor/learner relationship', answers.relationship);
    answers.stakes = await ask(rl, 'Scene stakes', answers.stakes);
    answers.condition = await ask(rl, 'Tutor condition (base|recognition)', answers.condition);
    answers.persona = await ask(rl, `Learner archetype (${[...PERSONAS].join('|')})`, answers.persona);
    answers.openingSpeaker = await ask(rl, 'Opening speaker (learner|tutor|director)', answers.openingSpeaker);
    answers.endingSpeaker = await ask(rl, 'Ending speaker (learner|tutor|director)', answers.endingSpeaker);
    answers.revisitPolicy = await ask(
      rl,
      'Director revisit policy (none|anchor|revoice|reconsider|reframe)',
      answers.revisitPolicy,
    );
    validateAnswers(answers);
    return answers;
  } finally {
    rl.close();
  }
}

function collectAnswers(args) {
  const answers = { ...DEFAULT_ANSWERS, ...args.answers };
  validateAnswers(answers);
  return answers;
}

function validateAnswers(answers) {
  for (const key of ['discipline', 'learnerLevel', 'topic', 'scenarioName', 'learnerStart']) {
    if (!answerValue(answers, key)) throw new Error(`${key} must not be empty`);
  }
  if (!CONDITIONS.has(answers.condition)) throw new Error('condition must be base|recognition');
  if (!PERSONAS.has(answers.persona)) throw new Error(`persona must be one of: ${[...PERSONAS].join(', ')}`);
  if (!REVISIT_POLICIES.has(answers.revisitPolicy))
    throw new Error('revisitPolicy must be none|anchor|revoice|reconsider|reframe');
  if (!SPEAKERS.has(answers.openingSpeaker)) throw new Error('openingSpeaker must be learner|tutor|director');
  if (!SPEAKERS.has(answers.endingSpeaker)) throw new Error('endingSpeaker must be learner|tutor|director');
}

function profilePair(condition) {
  if (condition === 'recognition') {
    return {
      tutorProfile: 'recognition',
      learnerProfile: 'ego_superego_recognition_authentic',
    };
  }
  return {
    tutorProfile: 'baseline',
    learnerProfile: 'ego_superego_authentic',
  };
}

function buildDramaSpec(answers, { runId, createdAt = new Date().toISOString() } = {}) {
  const profiles = profilePair(answers.condition);
  const learnerStart = [
    `Learner level: ${answers.learnerLevel}.`,
    answers.learnerStart,
    `Initial misframing to make publicly visible: ${answers.misframing}.`,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    meta: {
      status: 'DRAMA_GENERATOR_SINGLE',
      created: createdAt,
      source: 'scripts/drama-generator.js',
      artifact_id: runId,
      note: 'Single-scenario front-door spec. Generated public samples and held-out traces are produced by scripts/generate-pedagogical-dramas.js.',
    },
    dramas: [
      {
        id: 'DG1',
        discipline: answers.discipline,
        topic: answers.topic,
        learner_level: answers.learnerLevel,
        persona: answers.persona,
        condition: answers.condition,
        tutor_profile: profiles.tutorProfile,
        learner_profile: profiles.learnerProfile,
        scenario_name: answers.scenarioName,
        learner_start_state: learnerStart,
        scene_setting: answers.sceneSetting,
        relationship: answers.relationship,
        stakes: answers.stakes,
        opening_speaker: answers.openingSpeaker,
        ending_speaker: answers.endingSpeaker,
        tutor_personality: answers.tutorPersonality,
        learner_personality: answers.learnerPersonality,
        director_personality: answers.directorPersonality,
        tutor_voice_constraint: [
          `Tutor personality: ${answers.tutorPersonality}.`,
          'Interpret superego feedback privately; do not quote the superego or narrate internal review.',
          'The public tutor turn should introduce the lesson to the learner, not ruminate off-stage.',
        ].join(' '),
        learner_voice_constraint: [
          `Learner personality: ${answers.learnerPersonality}.`,
          `Learner level: ${answers.learnerLevel}.`,
          'The learner should not always use polished first-person reflection; allow partial speech, resistance, practical stakes, and changed wording when earned.',
        ].join(' '),
        voice_constraints: [
          'Avoid a fixed American AI-tutor cadence.',
          'Vary first, second, and third person according to the scene.',
          'Do not make every turn a validation-first exchange.',
        ].join(' '),
        person_policy:
          'Use direct address only when it is socially natural in the scene; indirect reference to work, objects, and prior wording is allowed.',
        direct_address_budget: 'No more than one direct validation beat per public turn.',
        director_note: [
          `Director personality: ${answers.directorPersonality}.`,
          'The Director may set the scene and occasionally intervene, but must not explain the hidden architecture in public stage directions.',
        ].join(' '),
        director_intervention:
          'An external pressure or visible object interrupts the smooth tutoring rhythm. The next speaker must respond to the scene, not only to the last sentence.',
        intended_tutor_character: answers.tutorPersonality,
        intended_lean: answers.revisitPolicy === 'reframe' ? 'recognition' : 'open',
        dramatic_shape: `${answers.misframing} -> ${answers.reframe}`,
      },
    ],
  };
}

function artifactPaths(outRoot, runId) {
  const rootDir = path.resolve(outRoot, runId);
  return {
    rootDir,
    specPath: path.join(rootDir, 'spec.yaml'),
    sampleDir: path.join(rootDir, 'sample'),
    delibDir: path.join(rootDir, 'deliberation'),
    transcriptsDir: path.join(rootDir, 'transcripts'),
    keyPath: path.join(rootDir, 'key.yaml'),
    batchPlanPath: path.join(rootDir, 'batch-plan.json'),
    summaryPath: path.join(rootDir, 'run-summary.json'),
    publicSamplePath: path.join(rootDir, 'sample', 'T01.txt'),
    fullTranscriptPath: path.join(rootDir, 'transcripts', 'T01.full.md'),
  };
}

function buildGeneratorCommand(args, answers, paths) {
  const cmd = [
    process.execPath,
    'scripts/generate-pedagogical-dramas.js',
    '--generator',
    args.generator,
    '--spec',
    paths.specPath,
    '--only',
    'DG1',
    '--max-turns',
    String(args.maxTurns),
    '--out-dir',
    paths.sampleDir,
    '--delib-dir',
    paths.delibDir,
    '--transcripts-dir',
    paths.transcriptsDir,
    '--key',
    paths.keyPath,
    '--director-revisit-policy',
    answers.revisitPolicy,
    '--director-revisit-anchor',
    'misframing-candidate',
    '--director-variation-key',
    path.basename(paths.rootDir),
  ];
  if (args.roleMap) cmd.push('--role-map', args.roleMap);
  if (args.model && usesClaudeGeneration(args)) cmd.push('--model', args.model);
  if (args.effort && usesClaudeGeneration(args)) cmd.push('--effort', args.effort);
  if (args.mock) cmd.push('--mock');
  if (args.force) cmd.push('--force');
  return cmd;
}

function usesClaudeGeneration(args) {
  return args.generator === 'claude' || /(?:^|,)\s*[^=]+=\s*claude\s*(?:,|$)/.test(String(args.roleMap || ''));
}

function writePlan({ args, answers, runId, paths, spec, command }) {
  if (args.dryRun) return;
  fs.mkdirSync(paths.rootDir, { recursive: true });
  fs.writeFileSync(paths.specPath, yaml.stringify(spec), 'utf8');
  fs.writeFileSync(
    paths.batchPlanPath,
    `${JSON.stringify(
      {
        batchId: runId,
        rootDir: path.relative(ROOT, paths.rootDir),
        generator: args.generator,
        roleMap: args.roleMap || null,
        claudeModel: usesClaudeGeneration(args) ? args.model : null,
        claudeEffort: usesClaudeGeneration(args) ? args.effort : null,
        repeats: 1,
        stressRepeats: 0,
        maxTurns: args.maxTurns,
        critics: [],
        units: [
          {
            id: 'drama-generator',
            kind: 'target',
            repeat: 'single',
            spec: path.relative(ROOT, paths.specPath),
            only: 'DG1',
            outDir: path.relative(ROOT, paths.sampleDir),
            delibDir: path.relative(ROOT, paths.delibDir),
            transcriptsDir: path.relative(ROOT, paths.transcriptsDir),
            keyPath: path.relative(ROOT, paths.keyPath),
          },
        ],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  fs.writeFileSync(
    paths.summaryPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        runId,
        answers,
        artifacts: {
          spec: path.relative(ROOT, paths.specPath),
          sampleDir: path.relative(ROOT, paths.sampleDir),
          deliberationDir: path.relative(ROOT, paths.delibDir),
          transcriptsDir: path.relative(ROOT, paths.transcriptsDir),
          key: path.relative(ROOT, paths.keyPath),
          batchPlan: path.relative(ROOT, paths.batchPlanPath),
        },
        command,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

function runGenerator(command) {
  return spawnSync(command[0], command.slice(1), {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
}

function rel(filePath) {
  return path.relative(ROOT, filePath);
}

function printResult({ args, paths, command }) {
  if (args.json) {
    console.log(
      JSON.stringify(
        {
          rootDir: paths.rootDir,
          specPath: paths.specPath,
          samplePath: fs.existsSync(paths.publicSamplePath) ? paths.publicSamplePath : null,
          fullTranscriptPath: fs.existsSync(paths.fullTranscriptPath) ? paths.fullTranscriptPath : null,
          command,
        },
        null,
        2,
      ),
    );
    return;
  }
  console.log(`\nwrote spec -> ${rel(paths.specPath)}`);
  console.log(`wrote run summary -> ${rel(paths.summaryPath)}`);
  if (fs.existsSync(paths.publicSamplePath)) console.log(`public sample -> ${rel(paths.publicSamplePath)}`);
  if (fs.existsSync(paths.fullTranscriptPath)) console.log(`full transcript -> ${rel(paths.fullTranscriptPath)}`);
  if (args.printCommand || args.specOnly) console.log(`\ngenerate command:\n  ${command.map(shellQuote).join(' ')}`);
}

function shellQuote(value) {
  const s = String(value);
  return /^[a-zA-Z0-9_./:=@+-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(helpText());
    return;
  }
  if (args.templatePath) {
    writeAnswersTemplate(args.templatePath);
    console.log(`wrote answers template -> ${rel(args.templatePath)}`);
    return;
  }
  const answers =
    args.nonInteractive || !process.stdin.isTTY ? collectAnswers(args) : await collectInteractiveAnswers(args.answers);
  const runId = runIdFor(args, answers);
  const paths = artifactPaths(args.outRoot, runId);
  const spec = buildDramaSpec(answers, { runId });
  const command = buildGeneratorCommand(args, answers, paths);

  if (args.dryRun) {
    console.log(yaml.stringify(spec));
    console.log(`\ngenerate command:\n  ${command.map(shellQuote).join(' ')}`);
    return;
  }

  if (fs.existsSync(paths.rootDir) && fs.readdirSync(paths.rootDir).length > 0 && !args.force) {
    throw new Error(`output root exists and is not empty: ${paths.rootDir} (pass --force or choose --id)`);
  }

  writePlan({ args, answers, runId, paths, spec, command });
  if (!args.specOnly) {
    const result = runGenerator(command);
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
  printResult({ args, paths, command });
}

if (path.resolve(process.argv[1] || '') === __filename) {
  main().catch((error) => {
    console.error(error?.stack || String(error));
    process.exit(1);
  });
}

export {
  DEFAULT_ANSWERS,
  artifactPaths,
  buildDramaSpec,
  buildGeneratorCommand,
  collectAnswers,
  loadAnswersFile,
  parseArgs,
  profilePair,
  runIdFor,
  slugify,
  writeAnswersTemplate,
};
