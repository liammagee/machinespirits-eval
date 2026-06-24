#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { renderPublicTranscript } from './build-derivation-transcript-pairwise-eval.js';
import { parseJudgeResponse } from '../services/rubricEvaluator.js';
import { buildDerivationAssessment } from '../services/dramaticDerivation/assessment.js';
import { loadWorld } from '../services/dramaticDerivation/world.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_RUN_DIR = path.join(ROOT, 'exports/dramatic-derivation/cast-layer-paired-transcript-comparison/runs');
const DEFAULT_OUT_DIR = path.join(ROOT, 'exports/dramatic-derivation/derivation-rubric-suite');
const DEFAULT_TIMEOUT_MS = 180_000;

const RUBRICS = Object.freeze({
  tutor_v22: {
    label: 'Tutor v2.2',
    file: 'config/evaluation-rubric.yaml',
    unit: 'tutor public conduct across the derivation transcript',
    focus:
      'Evaluate the tutor only. This adapts the main-line per-turn tutor rubric to the whole public derivation transcript by judging the tutor turns as a sequence.',
  },
  tutor_holistic: {
    label: 'Tutor Holistic v2.2',
    file: 'config/evaluation-rubric-tutor-holistic.yaml',
    unit: 'whole tutor trajectory',
    focus: 'Evaluate the tutor trajectory across the whole public transcript.',
  },
  learner_v22: {
    label: 'Learner v2.2',
    file: 'config/evaluation-rubric-learner.yaml',
    unit: 'learner public conduct across the derivation transcript',
    focus:
      'Evaluate the learner only. Treat grounded uptake, resistance, revision, and final assertion as public learner conduct.',
  },
  dialogue_quality: {
    label: 'Dialogue Quality v2.2',
    file: 'config/evaluation-rubric-dialogue.yaml',
    unit: 'whole public tutor-learner encounter',
    focus: 'Evaluate the emergent quality of the exchange, not either party in isolation.',
  },
  poetics: {
    label: 'Poetics v1.0',
    file: 'config/evaluation-rubric-poetics.yaml',
    unit: 'whole public didactic play',
    focus:
      'Evaluate the dramatic form of the public transcript. For scores above 3, include transcript evidence in the reasoning.',
  },
  deliberation: {
    label: 'Deliberation v1.0',
    file: 'config/evaluation-rubric-deliberation.yaml',
    unit: 'internal ego/superego deliberation trace',
    focus:
      'Evaluate only when the artifact contains a main-line-compatible internal deliberation trace. Derivation public transcripts alone are not enough.',
    internalOnly: true,
  },
});

const RUBRIC_ORDER = Object.freeze(Object.keys(RUBRICS));
const CLI_JUDGES = new Set(['none', 'claude', 'codex', 'gemini']);

function usage() {
  return `Usage:
  node scripts/score-derivation-transcript-rubric-suite.js \\
    --labels <label-a,label-b,...> \\
    [--run-dir exports/dramatic-derivation/cast-layer-paired-transcript-comparison/runs] \\
    [--out-dir exports/dramatic-derivation/derivation-rubric-suite] \\
    [--rubrics tutor_v22,tutor_holistic,learner_v22,dialogue_quality,poetics] \\
    [--judge-cli none|claude|codex|gemini] [--model <model>] [--judge-effort low|medium|high|xhigh|max] \\
    [--timeout-ms 180000] [--max-transcript-chars 60000] [--score-concurrency 1] \\
    [--resume-existing] [--force]

Default --judge-cli none writes proof gates, prompts, manifest, and an unscored report without calling any model.
`;
}

function resolveRepoPath(value) {
  return path.isAbsolute(value) ? value : path.resolve(ROOT, value);
}

export function parseArgs(argv = []) {
  const opts = {
    labels: [],
    runDir: DEFAULT_RUN_DIR,
    outDir: DEFAULT_OUT_DIR,
    rubrics: [...RUBRIC_ORDER],
    judgeCli: 'none',
    model: null,
    judgeEffort: null,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxTranscriptChars: 60_000,
    scoreConcurrency: 1,
    resumeExisting: false,
    force: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return { ...opts, help: true };
    if (arg === '--force') {
      opts.force = true;
      continue;
    }
    if (arg === '--resume-existing') {
      opts.resumeExisting = true;
      continue;
    }
    if (arg === '--labels') {
      opts.labels = String(argv[++i] || '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
      continue;
    }
    if (arg === '--run-dir') {
      opts.runDir = resolveRepoPath(argv[++i]);
      continue;
    }
    if (arg === '--out-dir') {
      opts.outDir = resolveRepoPath(argv[++i]);
      continue;
    }
    if (arg === '--rubrics') {
      opts.rubrics = String(argv[++i] || '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
      continue;
    }
    if (arg === '--judge-cli') {
      opts.judgeCli = String(argv[++i] || '').toLowerCase();
      continue;
    }
    if (arg === '--model') {
      opts.model = argv[++i] || null;
      continue;
    }
    if (arg === '--judge-effort') {
      opts.judgeEffort = argv[++i] || null;
      continue;
    }
    if (arg === '--timeout-ms') {
      opts.timeoutMs = Number(argv[++i]);
      continue;
    }
    if (arg === '--max-transcript-chars') {
      opts.maxTranscriptChars = Number(argv[++i]);
      continue;
    }
    if (arg === '--score-concurrency') {
      opts.scoreConcurrency = Number(argv[++i]);
      continue;
    }
    throw new Error(`Unknown argument ${arg}\n${usage()}`);
  }
  if (!CLI_JUDGES.has(opts.judgeCli)) {
    throw new Error(`--judge-cli must be one of ${[...CLI_JUDGES].join(', ')}`);
  }
  if (opts.judgeEffort && !['low', 'medium', 'high', 'xhigh', 'max'].includes(opts.judgeEffort)) {
    throw new Error(`--judge-effort must be low, medium, high, xhigh, or max, got ${JSON.stringify(opts.judgeEffort)}`);
  }
  const unknownRubrics = opts.rubrics.filter((key) => !RUBRICS[key]);
  if (unknownRubrics.length) {
    throw new Error(`Unknown rubric(s): ${unknownRubrics.join(', ')}. Known: ${RUBRIC_ORDER.join(', ')}`);
  }
  if (!Number.isFinite(opts.timeoutMs) || opts.timeoutMs <= 0) {
    throw new Error('--timeout-ms must be a positive number');
  }
  if (!Number.isFinite(opts.maxTranscriptChars) || opts.maxTranscriptChars < 1000) {
    throw new Error('--max-transcript-chars must be at least 1000');
  }
  if (!Number.isFinite(opts.scoreConcurrency) || opts.scoreConcurrency < 1) {
    throw new Error('--score-concurrency must be a positive integer');
  }
  opts.scoreConcurrency = Math.max(1, Math.floor(opts.scoreConcurrency));
  return opts;
}

function readJson(file, fallback = undefined) {
  if (!fs.existsSync(file)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required file: ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function loadRubric(key) {
  const spec = RUBRICS[key];
  const file = path.join(ROOT, spec.file);
  const data = YAML.parse(fs.readFileSync(file, 'utf8'));
  if (!data?.dimensions || typeof data.dimensions !== 'object') {
    throw new Error(`Rubric ${key} has no dimensions: ${file}`);
  }
  return { key, spec, file, data, dimensions: data.dimensions };
}

function scoreValue(raw) {
  if (typeof raw === 'number') return raw;
  if (raw && typeof raw === 'object' && typeof raw.score === 'number') return raw.score;
  return null;
}

function weightedOverall(dimensions, scores = {}) {
  let weighted = 0;
  let totalWeight = 0;
  for (const [key, dim] of Object.entries(dimensions || {})) {
    const score = scoreValue(scores[key]);
    if (!Number.isFinite(score)) continue;
    const weight = Number(dim.weight ?? 0);
    weighted += score * weight;
    totalWeight += weight;
  }
  if (!totalWeight) return null;
  return Number((((weighted / totalWeight - 1) / 4) * 100).toFixed(1));
}

function dimensionCriteria(dimensions) {
  return Object.entries(dimensions)
    .map(([key, dim]) => {
      const criteria = Object.entries(dim.criteria || {})
        .map(([score, text]) => `  ${score}: ${text}`)
        .join('\n');
      return `**${dim.name || key}** (key: ${key}, weight: ${Number(dim.weight ?? 0) * 100}%)
${dim.description || ''}
${criteria ? `Criteria:\n${criteria}` : ''}`.trim();
    })
    .join('\n\n');
}

function truncateTranscript(transcript, maxChars) {
  if (transcript.length <= maxChars) return transcript;
  return `${transcript.slice(0, maxChars)}\n\n[TRUNCATED at ${maxChars} characters for judging prompt]`;
}

function buildRubricPrompt({ artifact, rubric, transcript }) {
  const dimKeys = Object.keys(rubric.dimensions);
  const exampleScores = dimKeys
    .map((key) => `    "${key}": {"score": 3, "reasoning": "brief reason grounded in public transcript evidence"}`)
    .join(',\n');
  return `You are evaluating a public dramatic-derivation tutoring transcript using a rubric from the main Machine Spirits evaluation line.

The deterministic proof/problem-solving gate is reported separately. Here, score the public discourse quality requested by this rubric. Do not reward a transcript for raw formalism, private proof notation, rule IDs, premise IDs, D arithmetic, or hidden-state language appearing in public dialogue.

## Rubric

Name: ${rubric.data.name || rubric.spec.label}
Version: ${rubric.data.version || 'unknown'}
Unit adapted for derivative evaluation: ${rubric.spec.unit}
Focus: ${rubric.spec.focus}

Score each dimension from 1 to 5. Use only the transcript and public run summary below.

${dimensionCriteria(rubric.dimensions)}

## Public Run Summary

Label: ${artifact.label}
World: ${artifact.live.worldTitle || artifact.result.worldId || artifact.live.worldId || 'unknown'}
Verdict: ${artifact.proofGate.verdict}
Turns played: ${artifact.proofGate.turnsPlayed}
Final D: ${artifact.proofGate.finalD}
Forced/asserted gap: ${artifact.proofGate.forcedAssertedGap}
Release deviations: ${artifact.proofGate.releaseAdherence.deviationCount}
Public formalism leaks detected by regex: ${artifact.proofGate.publicFormalismLeakCount}

## Public Transcript

${transcript}

## Response Format

Return JSON only:

{
  "scores": {
${exampleScores}
  },
  "overall_score": 50,
  "summary": "brief overall assessment",
  "caveats": ["optional caveat"]
}`;
}

function hasCompatibleDeliberationTrace(artifact) {
  return Array.isArray(artifact.result?.dialogueTrace) && artifact.result.dialogueTrace.length > 0;
}

function parseScoredRubric({ raw, rubric }) {
  const parsed = parseJudgeResponse(raw);
  const scores = parsed.scores || {};
  return {
    status: 'scored',
    scores,
    overall: weightedOverall(rubric.dimensions, scores),
    judgeOverall: typeof parsed.overall_score === 'number' ? parsed.overall_score : null,
    summary: parsed.summary || null,
    caveats: parsed.caveats || [],
  };
}

function cliCommand(judgeCli, model, judgeEffort, tmpDir, outFile) {
  if (judgeCli === 'claude') {
    const args = ['-p', '-', '--output-format', 'text'];
    if (model) args.push('--model', model);
    if (judgeEffort) args.push('--effort', judgeEffort);
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;
    delete env.CLAUDECODE;
    return { bin: 'claude', args, env, cwd: ROOT, outputFile: null };
  }
  if (judgeCli === 'codex') {
    const args = [
      'exec',
      '--skip-git-repo-check',
      '--ephemeral',
      '-s',
      'read-only',
      '-C',
      tmpDir,
      '--color',
      'never',
      '-o',
      outFile,
      '-',
    ];
    if (model) args.splice(args.length - 2, 0, '-m', model);
    return { bin: 'codex', args, env: { ...process.env }, cwd: tmpDir, outputFile: outFile };
  }
  if (judgeCli === 'gemini') {
    const args = ['-s', '-o', 'text'];
    if (model) args.push('-m', model);
    return { bin: 'gemini', args, env: { ...process.env }, cwd: ROOT, outputFile: null };
  }
  throw new Error(`Unsupported judge CLI: ${judgeCli}`);
}

async function callCliJudge(prompt, { judgeCli, model, judgeEffort, timeoutMs }) {
  if (judgeCli === 'none') return null;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'derivation-rubric-suite-'));
  const outFile = path.join(tmpDir, 'last-message.txt');
  try {
    const command = cliCommand(judgeCli, model, judgeEffort, tmpDir, outFile);
    const stdout = await new Promise((resolve, reject) => {
      const child = spawn(command.bin, command.args, {
        cwd: command.cwd,
        env: command.env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      let out = '';
      let err = '';
      let settled = false;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn(value);
      };
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        finish(reject, new Error(`${judgeCli} judge timed out after ${timeoutMs} ms`));
      }, timeoutMs);
      child.stdout.on('data', (d) => {
        out += d;
      });
      child.stderr.on('data', (d) => {
        err += d;
      });
      child.on('error', (error) => finish(reject, error));
      child.on('close', (code) => {
        if (code !== 0) finish(reject, new Error(err || out || `${command.bin} exited with code ${code}`));
        else finish(resolve, out);
      });
      child.stdin.write(prompt);
      child.stdin.end();
    });
    if (command.outputFile && fs.existsSync(command.outputFile)) {
      const content = fs.readFileSync(command.outputFile, 'utf8');
      if (content.trim()) return content;
    }
    return stdout;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length || 1) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function loadArtifactWorld(diagnosis = {}) {
  if (!diagnosis.worldPath) return null;
  try {
    return loadWorld(path.resolve(ROOT, diagnosis.worldPath));
  } catch {
    return null;
  }
}

function liveFromResult(result = {}, label) {
  const dByTurn = new Map((result.trajectory || []).map((point) => [point.turn, point.D]));
  const byTurn = new Map();
  for (const line of result.transcript || []) {
    if (!Number.isFinite(line.turn)) continue;
    if (!byTurn.has(line.turn)) byTurn.set(line.turn, []);
    byTurn.get(line.turn).push({
      role: line.role,
      text: line.text,
      meta: line.meta || {},
    });
  }
  const turns = [...byTurn.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([turn, lines]) => ({
      turn,
      D: dByTurn.get(turn) ?? null,
      lines,
    }));
  return {
    label,
    worldId: result.worldId || null,
    verdict: result.verdict || null,
    turnsPlayed: result.turnsPlayed ?? turns.length,
    firstForcedTurn: result.firstForcedTurn ?? null,
    assertedGroundedTurn: result.assertedGroundedTurn ?? null,
    turns,
  };
}

function normalizeArtifactLive(live, result, label) {
  if (Array.isArray(live?.turns) && live.turns.length) return live;
  return liveFromResult(result, label);
}

function readArtifact({ runDir, label, maxTranscriptChars }) {
  const dir = path.join(runDir, label);
  const result = readJson(path.join(dir, 'result.json'));
  const live = normalizeArtifactLive(readJson(path.join(dir, 'live.json'), {}), result, label);
  const diagnosis = readJson(path.join(dir, 'diagnosis.json'), {});
  const world = loadArtifactWorld(diagnosis);
  const publicTranscript = truncateTranscript(renderPublicTranscript(live), maxTranscriptChars);
  const assessment = buildDerivationAssessment({ label, live, result, diagnosis, world });
  return {
    label,
    dir,
    live,
    result,
    diagnosis,
    world,
    publicTranscript,
    assessment,
    proofGate: assessment.proofGate,
    dagProfile: assessment.dagProfile,
    dialogueSummary: assessment.dialogueSummary,
  };
}

function reportTableRows(results, selectedRubrics) {
  return results.map((result) => {
    const proof = result.proofGate;
    const scoreCells = selectedRubrics.map((key) => {
      const row = result.rubrics[key];
      return row?.overall == null ? row?.status || 'n/a' : String(row.overall);
    });
    return `| ${result.label} | ${proof.status} | ${proof.verdict} | ${proof.turnsPlayed} | ${proof.finalD} | ${proof.forcedAssertedGap} | ${proof.releaseAdherence.deviationCount} | ${scoreCells.join(' | ')} |`;
  });
}

function appendDagReport(lines, profile) {
  if (!profile) {
    lines.push('Authored proof DAG: not available (world file was not present when this assessment ran).', '');
    return;
  }
  lines.push(`Authored proof DAG: ${profile.summary}`, '');
  lines.push(
    `- Earliest complete path turn: ${profile.metrics.earliestCompleteTurn ?? 'n/a'}; t_min ${
      profile.metrics.tMin ?? 'n/a'
    }; turn cap ${profile.metrics.turnCap ?? 'n/a'}.`,
  );
  for (const pathProfile of profile.paths) {
    const premiseList = pathProfile.premises
      .map((premise) => `${premise.id}${premise.scheduled ? `@t${premise.releaseTurn}` : '@unscheduled'}`)
      .join(' -> ');
    lines.push(`- ${pathProfile.id}: ${premiseList}`);
  }
  lines.push('');
}

function appendLearnerDagReport(lines, learnerDagAssessment) {
  if (!learnerDagAssessment || learnerDagAssessment.status !== 'available') {
    lines.push('Learner DAG: not available for this artifact.', '');
    return;
  }
  lines.push(
    `Learner DAG: source \`${learnerDagAssessment.source}\`; best authored-path coverage ${Math.round(
      learnerDagAssessment.bestPathCoverage * 100,
    )}% (${learnerDagAssessment.bestPathId || 'n/a'}); final secret entailed \`${learnerDagAssessment.finalSecretEntailed}\`; asserted secret \`${learnerDagAssessment.assertedSecret}\`; asserted mirror \`${learnerDagAssessment.assertedMirror}\`.`,
    '',
  );
  lines.push(
    `- First complete path turn: ${learnerDagAssessment.firstCompletePathTurn ?? 'n/a'}; first secret-entailed turn: ${
      learnerDagAssessment.firstSecretEntailedTurn ?? 'n/a'
    }; missing on best path: ${
      learnerDagAssessment.missingOnBestPath?.length ? learnerDagAssessment.missingOnBestPath.join(', ') : 'none'
    }.`,
    '',
  );
}

function renderReport({
  results,
  selectedRubrics,
  judgeCli,
  model,
  judgeEffort,
  outDir,
  runDir,
  scoreConcurrency,
  resumeExisting,
}) {
  const headers = selectedRubrics.map((key) => RUBRICS[key].label);
  const lines = [
    '# Derivation Transcript Rubric Suite',
    '',
    `Date: ${new Date().toISOString().slice(0, 10)}`,
    `Run directory: \`${path.relative(ROOT, runDir)}\``,
    `Output directory: \`${path.relative(ROOT, outDir)}\``,
    `Judge: \`${judgeCli}${model ? `/${model}` : ''}${judgeEffort ? `/${judgeEffort}` : ''}\``,
    `Score concurrency: \`${scoreConcurrency}\`; resume existing raw judgments: \`${Boolean(resumeExisting)}\``,
    '',
    '## Interpretation Boundary',
    '',
    'The proof/problem-solving gate is primary: it checks whether the public discourse reaches a grounded assertion under the authored derivation and release constraints. The imported main-line rubric scores are secondary quality measures: they ask whether a proof-safe discourse is better as tutoring, dialogue, learner conduct, or dramatic form.',
    '',
    'Do not collapse these rows into one master score. A cast/rhetorical/dramatic change must first avoid proof-control harm; only then can rubric gains count as dialogue-quality or reader-quality evidence.',
    '',
    '## Summary',
    '',
    `| Label | Proof gate | Verdict | Turns | Final D | Forced/asserted gap | Release deviations | ${headers.join(' | ')} |`,
    `| --- | --- | --- | ---: | ---: | ---: | ---: | ${headers.map(() => '---:').join(' | ')} |`,
    ...reportTableRows(results, selectedRubrics),
    '',
    '## Per-Run Details',
    '',
  ];
  for (const result of results) {
    lines.push(`### ${result.label}`, '');
    lines.push(
      `Proof gate: \`${result.proofGate.status}\`; verdict \`${result.proofGate.verdict}\`; turns ${result.proofGate.turnsPlayed}; final D ${result.proofGate.finalD}; forced/asserted gap ${result.proofGate.forcedAssertedGap}; release deviations ${result.proofGate.releaseAdherence.deviationCount}.`,
    );
    lines.push(
      `Dialogue surface: ${result.dialogueSummary.sceneCount ?? 'n/a'} scenes; ${result.dialogueSummary.tutorLines} tutor lines; ${result.dialogueSummary.learnerLines} learner lines; avg tutor words ${result.dialogueSummary.avgTutorWords}; avg learner words ${result.dialogueSummary.avgLearnerWords}.`,
      '',
    );
    appendDagReport(lines, result.dagProfile);
    appendLearnerDagReport(lines, result.learnerDagAssessment);
    for (const key of selectedRubrics) {
      const row = result.rubrics[key];
      lines.push(`- **${RUBRICS[key].label}:** ${row.overall == null ? row.status : row.overall}`);
      if (row.summary) lines.push(`  ${row.summary}`);
      if (row.error) lines.push(`  Error: ${row.error}`);
    }
    lines.push('');
  }
  lines.push('## Commands', '', '```bash');
  lines.push(
    `node scripts/score-derivation-transcript-rubric-suite.js --labels ${results
      .map((result) => result.label)
      .join(
        ',',
      )} --run-dir ${path.relative(ROOT, runDir)} --out-dir ${path.relative(ROOT, outDir)} --judge-cli ${judgeCli}${
      model ? ` --model ${model}` : ''
    }${judgeEffort ? ` --judge-effort ${judgeEffort}` : ''}`,
  );
  lines.push('```', '');
  return `${lines.join('\n')}`;
}

export async function scoreDerivationRubricSuite({
  labels,
  runDir = DEFAULT_RUN_DIR,
  outDir = DEFAULT_OUT_DIR,
  rubrics = [...RUBRIC_ORDER],
  judgeCli = 'none',
  model = null,
  judgeEffort = null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxTranscriptChars = 60_000,
  scoreConcurrency = 1,
  resumeExisting = false,
  force = false,
} = {}) {
  if (!Array.isArray(labels) || labels.length === 0) {
    throw new Error(`At least one label is required.\n${usage()}`);
  }
  if (fs.existsSync(outDir) && !force && !resumeExisting) {
    throw new Error(`Output directory already exists: ${outDir}. Pass --force to replace generated files.`);
  }
  if (!resumeExisting) fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const promptsDir = path.join(outDir, 'prompts');
  const rawDir = path.join(outDir, 'raw');
  fs.mkdirSync(promptsDir, { recursive: true });
  fs.mkdirSync(rawDir, { recursive: true });

  const loadedRubrics = Object.fromEntries(rubrics.map((key) => [key, loadRubric(key)]));
  const results = [];
  const scoringTasks = [];
  for (const label of labels) {
    const artifact = readArtifact({ runDir, label, maxTranscriptChars });
    const result = {
      label,
      sourceDir: path.relative(ROOT, artifact.dir),
      assessment: {
        schema: artifact.assessment.schema,
        authority: artifact.assessment.authority,
        interpretation: artifact.assessment.interpretation,
      },
      proofGate: artifact.proofGate,
      dagProfile: artifact.dagProfile,
      learnerDagAssessment: artifact.assessment.learnerDagAssessment,
      learnerDag: artifact.assessment.learnerDag,
      dialogueSummary: artifact.dialogueSummary,
      rubrics: {},
    };
    for (const key of rubrics) {
      const rubric = loadedRubrics[key];
      if (rubric.spec.internalOnly && !hasCompatibleDeliberationTrace(artifact)) {
        result.rubrics[key] = {
          status: 'not_applicable',
          overall: null,
          prompt: null,
          rubricVersion: rubric.data.version || null,
          reason:
            'Main-line deliberation scoring requires comparable internal ego/superego traces; this derivation artifact exposes public transcript/proof metadata only.',
        };
        continue;
      }
      const prompt = buildRubricPrompt({
        artifact,
        rubric,
        transcript: artifact.publicTranscript,
      });
      const promptFile = path.join(promptsDir, `${label}.${key}.md`);
      const rawFile = path.join(rawDir, `${label}.${key}.txt`);
      fs.writeFileSync(promptFile, prompt);
      if (judgeCli === 'none') {
        result.rubrics[key] = {
          status: 'not_scored',
          overall: null,
          prompt: path.relative(outDir, promptFile),
          rubricVersion: rubric.data.version || null,
        };
        continue;
      }
      scoringTasks.push({ result, key, rubric, prompt, promptFile, rawFile });
    }
    results.push(result);
  }
  await mapWithConcurrency(scoringTasks, scoreConcurrency, async (task) => {
    const { result, key, rubric, prompt, promptFile, rawFile } = task;
    try {
      let raw;
      let reusedRaw = false;
      if (resumeExisting && fs.existsSync(rawFile)) {
        raw = fs.readFileSync(rawFile, 'utf8');
        reusedRaw = true;
      } else {
        raw = await callCliJudge(prompt, { judgeCli, model, judgeEffort, timeoutMs });
        fs.writeFileSync(rawFile, raw);
      }
      result.rubrics[key] = {
        ...parseScoredRubric({ raw, rubric }),
        prompt: path.relative(outDir, promptFile),
        raw: path.relative(outDir, rawFile),
        reusedRaw,
        rubricVersion: rubric.data.version || null,
      };
    } catch (error) {
      result.rubrics[key] = {
        status: 'error',
        overall: null,
        prompt: path.relative(outDir, promptFile),
        error: error.message,
        rubricVersion: rubric.data.version || null,
      };
    }
  });
  const manifest = {
    schema: 'machinespirits.derivation.transcript-rubric-suite.v1',
    generatedAt: new Date().toISOString(),
    runDir,
    outDir,
    judgeCli,
    model,
    judgeEffort,
    scoreConcurrency,
    resumeExisting,
    rubrics,
    rubricFiles: Object.fromEntries(rubrics.map((key) => [key, RUBRICS[key].file])),
    results,
  };
  writeJson(path.join(outDir, 'scores.json'), manifest);
  fs.writeFileSync(
    path.join(outDir, 'report.md'),
    renderReport({
      results,
      selectedRubrics: rubrics,
      judgeCli,
      model,
      judgeEffort,
      outDir,
      runDir,
      scoreConcurrency,
      resumeExisting,
    }),
  );
  return manifest;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      process.stdout.write(usage());
      process.exit(0);
    }
    const result = await scoreDerivationRubricSuite(args);
    process.stdout.write(`Wrote ${result.results.length} derivation rubric-suite row(s) to ${result.outDir}\n`);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exit(1);
  }
}
