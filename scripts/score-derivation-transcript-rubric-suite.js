#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { renderPublicTranscript } from './build-derivation-transcript-pairwise-eval.js';
import { parseJudgeResponse } from '../services/rubricEvaluator.js';

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
const PUBLIC_FORMALISM_RE =
  /\b[a-z]+[A-Z][A-Za-z0-9]*\b|\?[a-zA-Z_][a-zA-Z0-9_]*|[a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\)|\bD\s*=\s*\d/u;

function usage() {
  return `Usage:
  node scripts/score-derivation-transcript-rubric-suite.js \\
    --labels <label-a,label-b,...> \\
    [--run-dir exports/dramatic-derivation/cast-layer-paired-transcript-comparison/runs] \\
    [--out-dir exports/dramatic-derivation/derivation-rubric-suite] \\
    [--rubrics tutor_v22,tutor_holistic,learner_v22,dialogue_quality,poetics] \\
    [--judge-cli none|claude|codex|gemini] [--model <model>] \\
    [--timeout-ms 180000] [--max-transcript-chars 60000] [--force]

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
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxTranscriptChars: 60_000,
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
    if (arg === '--timeout-ms') {
      opts.timeoutMs = Number(argv[++i]);
      continue;
    }
    if (arg === '--max-transcript-chars') {
      opts.maxTranscriptChars = Number(argv[++i]);
      continue;
    }
    throw new Error(`Unknown argument ${arg}\n${usage()}`);
  }
  if (!CLI_JUDGES.has(opts.judgeCli)) {
    throw new Error(`--judge-cli must be one of ${[...CLI_JUDGES].join(', ')}`);
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

function publicLines(live) {
  const out = [];
  for (const turn of Array.isArray(live?.turns) ? live.turns : []) {
    for (const line of Array.isArray(turn.lines) ? turn.lines : []) {
      if (!['stage', 'director', 'tutor', 'learner'].includes(line.role)) continue;
      const text = String(line.text || '').replace(/\s+/gu, ' ').trim();
      if (!text) continue;
      out.push({
        turn: turn.turn,
        role: line.role === 'director' ? 'stage' : line.role,
        text,
        exchangeType: turn.exchange?.type || line.meta?.exchange?.type || null,
      });
    }
  }
  return out;
}

function countBy(values) {
  return values.reduce((acc, value) => {
    const key = value || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function releaseDeviationCount(releaseAdherence = {}) {
  return (
    (releaseAdherence.deviations?.length || 0) +
    (releaseAdherence.missed?.length || 0) +
    (releaseAdherence.unscheduled?.length || 0)
  );
}

function deriveProofGate({ live, result, diagnosis, label }) {
  const finalTurn = Array.isArray(live.turns) ? live.turns.at(-1) : null;
  const releaseAdherence = diagnosis.releaseAdherence || {};
  const finalD = finalTurn?.D ?? null;
  const verdict = result.verdict || live.verdict || diagnosis.verdict || null;
  const forcedTurn = result.firstForcedTurn ?? live.firstForcedTurn ?? diagnosis.firstForcedTurn ?? null;
  const assertedTurn =
    result.assertedGroundedTurn ?? live.assertedGroundedTurn ?? diagnosis.assertedGroundedTurn ?? null;
  const forcedAssertedGap =
    Number.isFinite(forcedTurn) && Number.isFinite(assertedTurn) ? assertedTurn - forcedTurn : null;
  const lines = publicLines(live);
  const formalismLeaks = lines.filter((line) => PUBLIC_FORMALISM_RE.test(line.text));
  const releaseDeviations = releaseDeviationCount(releaseAdherence);
  const grounded = verdict === 'grounded_anagnorisis';
  const gatePass = grounded && finalD === 0 && releaseDeviations === 0 && formalismLeaks.length === 0;
  return {
    schema: 'machinespirits.derivation.problem-solving-gate.v1',
    label,
    status: gatePass ? 'pass' : 'fail',
    verdict,
    turnsPlayed: result.turnsPlayed ?? live.turnsPlayed ?? diagnosis.turnsPlayed ?? live.turns?.length ?? null,
    finalD,
    firstForcedTurn: forcedTurn,
    assertedGroundedTurn: assertedTurn,
    forcedAssertedGap,
    releaseAdherence: {
      onCue: releaseAdherence.onCue ?? null,
      deviations: releaseAdherence.deviations || [],
      missed: releaseAdherence.missed || [],
      unscheduled: releaseAdherence.unscheduled || [],
      deviationCount: releaseDeviations,
    },
    publicFormalismLeakCount: formalismLeaks.length,
    publicFormalismLeaks: formalismLeaks.slice(0, 10),
    overreach: diagnosis.fabricatedFacts?.count ?? diagnosis.overreach ?? null,
    luckyLeap: diagnosis.luckyLeap ?? null,
    interpretation:
      'This gate measures problem-solving ability of the public derivation discourse: grounded assertion under proof/release constraints. Rubric scores below are secondary quality measures.',
  };
}

function summarizeDialogue(live, diagnosis = {}) {
  const lines = publicLines(live);
  const tutor = lines.filter((line) => line.role === 'tutor');
  const learner = lines.filter((line) => line.role === 'learner');
  const words = (text) => String(text || '').split(/\s+/u).filter(Boolean).length;
  const avg = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
  return {
    publicLineCount: lines.length,
    tutorLines: tutor.length,
    learnerLines: learner.length,
    avgTutorWords: Number(avg(tutor.map((line) => words(line.text))).toFixed(1)),
    avgLearnerWords: Number(avg(learner.map((line) => words(line.text))).toFixed(1)),
    exchangeTypes:
      diagnosis.scenes?.exchangeTypes ||
      countBy((live.turns || []).map((turn) => turn.exchange?.type || 'unknown')),
    sceneCount: diagnosis.scenes?.count ?? null,
    avgSceneExchanges: diagnosis.scenes?.avgExchanges ?? null,
    recognitionNeed: diagnosis.scenes?.recognitionNeed || null,
    phaticRecognition: diagnosis.scenes?.phaticRecognition || null,
  };
}

function truncateTranscript(transcript, maxChars) {
  if (transcript.length <= maxChars) return transcript;
  return `${transcript.slice(0, maxChars)}\n\n[TRUNCATED at ${maxChars} characters for judging prompt]`;
}

function buildRubricPrompt({ artifact, rubric, transcript }) {
  const dimKeys = Object.keys(rubric.dimensions);
  const exampleScores = dimKeys
    .map(
      (key) =>
        `    "${key}": {"score": 3, "reasoning": "brief reason grounded in public transcript evidence"}`,
    )
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

function cliCommand(judgeCli, model, tmpDir, outFile) {
  if (judgeCli === 'claude') {
    const args = ['-p', '-', '--output-format', 'text'];
    if (model) args.push('--model', model);
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

async function callCliJudge(prompt, { judgeCli, model, timeoutMs }) {
  if (judgeCli === 'none') return null;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'derivation-rubric-suite-'));
  const outFile = path.join(tmpDir, 'last-message.txt');
  try {
    const command = cliCommand(judgeCli, model, tmpDir, outFile);
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

function readArtifact({ runDir, label, maxTranscriptChars }) {
  const dir = path.join(runDir, label);
  const live = readJson(path.join(dir, 'live.json'));
  const result = readJson(path.join(dir, 'result.json'));
  const diagnosis = readJson(path.join(dir, 'diagnosis.json'), {});
  const publicTranscript = truncateTranscript(renderPublicTranscript(live), maxTranscriptChars);
  const proofGate = deriveProofGate({ live, result, diagnosis, label });
  return {
    label,
    dir,
    live,
    result,
    diagnosis,
    publicTranscript,
    proofGate,
    dialogueSummary: summarizeDialogue(live, diagnosis),
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

function renderReport({ results, selectedRubrics, judgeCli, model, outDir, runDir }) {
  const headers = selectedRubrics.map((key) => RUBRICS[key].label);
  const lines = [
    '# Derivation Transcript Rubric Suite',
    '',
    `Date: ${new Date().toISOString().slice(0, 10)}`,
    `Run directory: \`${path.relative(ROOT, runDir)}\``,
    `Output directory: \`${path.relative(ROOT, outDir)}\``,
    `Judge: \`${judgeCli}${model ? `/${model}` : ''}\``,
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
      .join(',')} --run-dir ${path.relative(ROOT, runDir)} --out-dir ${path.relative(ROOT, outDir)} --judge-cli ${judgeCli}`,
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
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxTranscriptChars = 60_000,
  force = false,
} = {}) {
  if (!Array.isArray(labels) || labels.length === 0) {
    throw new Error(`At least one label is required.\n${usage()}`);
  }
  if (fs.existsSync(outDir) && !force) {
    throw new Error(`Output directory already exists: ${outDir}. Pass --force to replace generated files.`);
  }
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const promptsDir = path.join(outDir, 'prompts');
  const rawDir = path.join(outDir, 'raw');
  fs.mkdirSync(promptsDir, { recursive: true });
  fs.mkdirSync(rawDir, { recursive: true });

  const loadedRubrics = Object.fromEntries(rubrics.map((key) => [key, loadRubric(key)]));
  const results = [];
  for (const label of labels) {
    const artifact = readArtifact({ runDir, label, maxTranscriptChars });
    const result = {
      label,
      sourceDir: path.relative(ROOT, artifact.dir),
      proofGate: artifact.proofGate,
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
      try {
        const raw = await callCliJudge(prompt, { judgeCli, model, timeoutMs });
        const rawFile = path.join(rawDir, `${label}.${key}.txt`);
        fs.writeFileSync(rawFile, raw);
        result.rubrics[key] = {
          ...parseScoredRubric({ raw, rubric }),
          prompt: path.relative(outDir, promptFile),
          raw: path.relative(outDir, rawFile),
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
    }
    results.push(result);
  }
  const manifest = {
    schema: 'machinespirits.derivation.transcript-rubric-suite.v1',
    generatedAt: new Date().toISOString(),
    runDir,
    outDir,
    judgeCli,
    model,
    rubrics,
    rubricFiles: Object.fromEntries(rubrics.map((key) => [key, RUBRICS[key].file])),
    results,
  };
  writeJson(path.join(outDir, 'scores.json'), manifest);
  fs.writeFileSync(path.join(outDir, 'report.md'), renderReport({ results, selectedRubrics: rubrics, judgeCli, model, outDir, runDir }));
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
