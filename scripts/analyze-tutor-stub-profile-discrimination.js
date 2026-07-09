#!/usr/bin/env node
/**
 * Compact tutor-stub traces into behavior-only turn frames, then compare
 * automated learner profiles by classifier/DAG trajectory signatures.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const FIELD_RANKS = {
  evidence_use: {
    none: 0,
    repeats_setup: 0.1,
    cites_public_evidence: 0.4,
    revises_from_evidence: 0.5,
    links_evidence_to_rule: 0.7,
    overleaps_evidence: -0.2,
  },
  agency: {
    passive: 0,
    complying: 0.2,
    attempting: 0.5,
    steering: 0.55,
    self_correcting: 0.8,
  },
  epistemic_stance: {
    answer_seeking: 0.1,
    receptive: 0.2,
    confused: 0.25,
    exploratory: 0.5,
    reflective: 0.65,
    grounded: 0.75,
    overconfident: 0.15,
    resistant: 0.1,
  },
  discourse_move: {
    off_task: 0,
    answer_seeking: 0.1,
    question: 0.3,
    repair_request: 0.35,
    challenge: 0.35,
    claim: 0.45,
    hypothesis: 0.5,
    evidence_adoption: 0.65,
    inference: 0.75,
    metacognitive_reflection: 0.8,
  },
};

const VECTOR_FIELDS = [
  'requestType',
  'discourseMove',
  'evidenceUse',
  'epistemicStance',
  'agency',
  'affect',
];

function parseArgs(argv) {
  const args = {
    traceRoot: '',
    compactedRoot: '',
    traces: [],
    compacted: [],
    writeCompacted: '',
    out: '',
    json: false,
    includeText: false,
    targetAverageCosine: 0.85,
    targetMaxToControl: 0.9,
    controlProfile: 'diligent',
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--help' || token === '-h') {
      printUsage();
      process.exit(0);
    }
    if (token === '--json') {
      args.json = true;
      continue;
    }
    if (token === '--include-text') {
      args.includeText = true;
      continue;
    }
    if (token === '--trace-root') {
      args.traceRoot = path.resolve(argv[++i] || '');
      continue;
    }
    if (token === '--compacted-root') {
      args.compactedRoot = path.resolve(argv[++i] || '');
      continue;
    }
    if (token === '--trace') {
      args.traces.push(path.resolve(argv[++i] || ''));
      continue;
    }
    if (token === '--compacted') {
      args.compacted.push(path.resolve(argv[++i] || ''));
      continue;
    }
    if (token === '--write-compacted') {
      args.writeCompacted = path.resolve(argv[++i] || '');
      continue;
    }
    if (token === '--out') {
      args.out = path.resolve(argv[++i] || '');
      continue;
    }
    if (token === '--target-average-cosine') {
      args.targetAverageCosine = numberArg(argv[++i], '--target-average-cosine');
      continue;
    }
    if (token === '--target-max-to-control') {
      args.targetMaxToControl = numberArg(argv[++i], '--target-max-to-control');
      continue;
    }
    if (token === '--control-profile') {
      args.controlProfile = String(argv[++i] || '').trim() || 'diligent';
      continue;
    }
    if (token.startsWith('--')) {
      throw new Error(`Unknown option: ${token}`);
    }
    args.traces.push(path.resolve(token));
  }

  return args;
}

function numberArg(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${name} must be a number`);
  return number;
}

function printUsage() {
  console.log(`Usage:
  node scripts/analyze-tutor-stub-profile-discrimination.js --trace-root <dir> [options]
  node scripts/analyze-tutor-stub-profile-discrimination.js --compacted-root <dir> [options]

Options:
  --trace-root <dir>             Recursively read tutor-stub .jsonl traces
  --trace <file>                 Read one trace; may be repeated
  --compacted-root <dir>         Recursively read compacted trace .json files
  --compacted <file>             Read one compacted trace; may be repeated
  --write-compacted <dir>        Write compacted traces for reuse
  --include-text                 Preserve short learner/tutor snippets in compacted traces
  --target-average-cosine <n>    Gate threshold for average pairwise cosine (default: 0.85)
  --target-max-to-control <n>    Gate threshold for max similarity to control profile (default: 0.90)
  --control-profile <id>         Control profile for max-to-control gate (default: diligent)
  --json                         Print JSON instead of Markdown
  --out <file>                   Write report to file
`);
}

function readJsonl(file) {
  const text = fs.readFileSync(file, 'utf8').trim();
  if (!text) return [];
  return text.split(/\r?\n/u).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`${file}:${index + 1}: invalid JSON: ${error.message}`);
    }
  });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function walkFiles(dir, predicate) {
  if (!dir || !fs.existsSync(dir)) return [];
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (predicate(fullPath)) {
        out.push(fullPath);
      }
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function normalizeRubricScore(value) {
  const number = asNumber(value);
  if (number == null) return null;
  return clamp((number - 1) / 4);
}

function rankValue(mapName, value) {
  if (value == null) return null;
  return FIELD_RANKS[mapName]?.[String(value).trim()] ?? null;
}

function mean(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) return null;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function round(value, digits = 3) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function snippet(value, max = 220) {
  const text = String(value || '').replace(/\s+/gu, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}...`;
}

function safeSlug(value) {
  return String(value || 'unknown')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 120) || 'unknown';
}

function inferProfile(file, root, metadata = {}) {
  const profileId = metadata.autoLearner?.profileId || metadata.autoLearnerProfileId || metadata.profileId;
  if (profileId) return String(profileId);

  const rel = root ? path.relative(root, file) : file;
  const parts = rel.split(path.sep);
  const tracesIndex = parts.indexOf('traces');
  if (tracesIndex > 0) return parts[tracesIndex - 1];
  return 'unknown';
}

function inferPolicy(file, firstTurn = null) {
  const policy = firstTurn?.registerSelection?.policy;
  if (policy) return String(policy);
  const parent = path.basename(path.dirname(file));
  const match = parent.match(/^(.+)-r\d+$/u);
  return match ? match[1] : parent || 'unknown';
}

function dagSnapshot(turn) {
  const model = turn.tutorLearnerDagModel || {};
  const assessment = model.assessment || {};
  const metrics = model.metrics || {};
  return {
    status: assessment.status || null,
    bestPathCoverage: asNumber(assessment.bestPathCoverage),
    missingPremiseCount: asNumber(metrics.missingPremiseCount ?? assessment.missingPremiseCount),
    groundedCount: asNumber(metrics.groundedCount),
    voicedDerivedCount: asNumber(metrics.voicedDerivedCount ?? assessment.voicedDerivedCount),
    hypothesisCount: asNumber(metrics.hypothesisCount ?? assessment.hypothesisCount),
    candidateConclusionCount: asNumber(metrics.candidateConclusionCount),
    answerCandidateCount: asNumber(metrics.answerCandidateCount),
    unsupportedAssertionCount: asNumber(assessment.unsupportedAssertionCount),
    finalSecretEntailed: Boolean(assessment.finalSecretEntailed),
    assertedSecret: Boolean(assessment.assertedSecret),
    assertedMirror: Boolean(assessment.assertedMirror),
    bottleneck: assessment.bottleneck || null,
  };
}

function scoreTurnField(classifier) {
  const dimensions = {
    conceptual: normalizeRubricScore(classifier?.scores?.conceptual_engagement?.score),
    epistemic: normalizeRubricScore(classifier?.scores?.epistemic_readiness?.score),
    evidence: rankValue('evidence_use', classifier?.evidence_use),
    agency: rankValue('agency', classifier?.agency),
    stance: rankValue('epistemic_stance', classifier?.epistemic_stance),
    discourse: rankValue('discourse_move', classifier?.discourse_move),
  };
  return {
    score: mean(Object.values(dimensions)),
    dimensions,
  };
}

function compactTurn(turn, args) {
  const classifier = turn.classification?.turn || {};
  const register = turn.registerSelection || {};
  const efficacy = turn.previousRegisterEfficacy || {};
  const compact = {
    turn: asNumber(turn.turn),
    classifier: {
      summary: snippet(classifier.summary, 280) || null,
      requestType: classifier.request_type || null,
      discourseMove: classifier.discourse_move || null,
      evidenceUse: classifier.evidence_use || null,
      epistemicStance: classifier.epistemic_stance || null,
      affect: classifier.affect || null,
      agency: classifier.agency || null,
      conceptualScore: asNumber(classifier.scores?.conceptual_engagement?.score),
      epistemicReadinessScore: asNumber(classifier.scores?.epistemic_readiness?.score),
      pedagogicalNeed: snippet(classifier.pedagogical_need, 280) || null,
    },
    field: scoreTurnField(classifier),
    dag: dagSnapshot(turn),
    register: {
      policy: register.policy || null,
      selected: register.selected_register || register.selected_mode || null,
      confidence: asNumber(register.confidence ?? register.selected_probability),
      entropyBits: asNumber(register.register_vector_entropy_bits),
      distribution: Array.isArray(register.distribution)
        ? register.distribution.map((item) => ({
            register: item.register,
            probability: asNumber(item.probability),
          }))
        : [],
    },
    efficacy: {
      selected: efficacy.selected_register || null,
      label: efficacy.label || null,
      fieldDelta: asNumber(efficacy.field?.delta),
      summary: snippet(efficacy.summary, 220) || null,
    },
    audit: {
      leakOk: turn.tutorLeakAudit?.ok ?? null,
      repaired: Boolean(turn.tutorResponseRepaired),
      deterministicFallback: Boolean(turn.tutorDeterministicFallback),
    },
  };
  if (args.includeText) {
    compact.text = {
      learner: snippet(turn.learner, 320),
      tutor: snippet(turn.tutor, 320),
    };
  }
  return compact;
}

function compactTrace(file, root, args) {
  const events = readJsonl(file);
  const start = events.find((event) => event.type === 'run_start') || null;
  const metadata = start?.metadata || {};
  const turnEvents = events.filter((event) => event.type === 'turn_complete' && event.turnRecord);
  const turns = turnEvents
    .map((event) => event.turnRecord)
    .sort((a, b) => Number(a.turn || 0) - Number(b.turn || 0));
  const firstTurn = turns[0] || null;
  const finalTurn = turns.at(-1) || null;
  const profile = inferProfile(file, root, metadata);
  const policy = inferPolicy(file, firstTurn);
  const compactTurns = turns.map((turn) => compactTurn(turn, args));
  const finalDag = compactTurns.at(-1)?.dag || {};
  const runKey = path.basename(path.dirname(file));

  return {
    schema: 'machinespirits.tutor-stub.compacted-trace.v1',
    generatedAt: new Date().toISOString(),
    sourceTrace: path.relative(ROOT, file),
    run: {
      profile,
      policy,
      runKey,
      startedAt: start?.ts || events[0]?.ts || null,
      turnCount: compactTurns.length,
      world: metadata.world?.id || metadata.worldId || null,
      model: finalTurn?.model || metadata.resolved?.model || metadata.modelRef || null,
      provider: finalTurn?.provider || metadata.resolved?.provider || null,
      analysisModel: metadata.classifier?.resolved?.model || metadata.classifier?.modelRef || null,
      memorySummary: metadata.memorySummary || null,
    },
    final: {
      bestPathCoverage: finalDag.bestPathCoverage ?? null,
      missingPremiseCount: finalDag.missingPremiseCount ?? null,
      bottleneck: finalDag.bottleneck || null,
      finalSecretEntailed: Boolean(finalDag.finalSecretEntailed),
      assertedSecret: Boolean(finalDag.assertedSecret),
      groundedClosure: Boolean(
        finalDag.bottleneck === 'grounded_asserted_secret' ||
          (finalDag.finalSecretEntailed === true && finalDag.assertedSecret === true),
      ),
    },
    turns: compactTurns,
  };
}

function readCompacted(file) {
  const compacted = readJson(file);
  if (compacted.schema !== 'machinespirits.tutor-stub.compacted-trace.v1') {
    throw new Error(`Not a compacted tutor-stub trace: ${file}`);
  }
  return compacted;
}

function writeCompactedTrace(compacted, outDir, usedNames) {
  const profile = safeSlug(compacted.run?.profile || 'unknown');
  const policy = safeSlug(compacted.run?.policy || 'unknown');
  const runKey = safeSlug(compacted.run?.runKey || path.basename(compacted.sourceTrace || 'trace'));
  const profileDir = path.join(outDir, profile);
  fs.mkdirSync(profileDir, { recursive: true });
  let basename = `${policy}-${runKey}.compact-trace.json`;
  let serial = 2;
  while (usedNames.has(path.join(profileDir, basename))) {
    basename = `${policy}-${runKey}-${serial}.compact-trace.json`;
    serial += 1;
  }
  const fullPath = path.join(profileDir, basename);
  usedNames.add(fullPath);
  fs.writeFileSync(fullPath, `${JSON.stringify(compacted, null, 2)}\n`);
  return fullPath;
}

function addVector(vector, key, amount = 1) {
  if (!key) return;
  vector.set(key, (vector.get(key) || 0) + amount);
}

function vectorForTrace(compacted) {
  const vector = new Map();
  for (const turn of compacted.turns || []) {
    for (const field of VECTOR_FIELDS) {
      const value = turn.classifier?.[field];
      if (value) addVector(vector, `${field}:${value}`);
    }
    const conceptual = turn.classifier?.conceptualScore;
    if (Number.isFinite(conceptual)) addVector(vector, `conceptualScore:${conceptual}`);
    const epistemic = turn.classifier?.epistemicReadinessScore;
    if (Number.isFinite(epistemic)) addVector(vector, `epistemicReadinessScore:${epistemic}`);
  }
  return vector;
}

function combineVectors(vectors) {
  const combined = new Map();
  for (const vector of vectors) {
    for (const [key, value] of vector.entries()) addVector(combined, key, value);
  }
  return combined;
}

function cosine(a, b) {
  const keys = new Set([...a.keys(), ...b.keys()]);
  let dot = 0;
  let aMag = 0;
  let bMag = 0;
  for (const key of keys) {
    const av = a.get(key) || 0;
    const bv = b.get(key) || 0;
    dot += av * bv;
    aMag += av * av;
    bMag += bv * bv;
  }
  if (!aMag || !bMag) return null;
  return dot / (Math.sqrt(aMag) * Math.sqrt(bMag));
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item) || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function summarizeProfile(profile, traces) {
  const turns = traces.flatMap((trace) => trace.turns || []);
  const finals = traces.map((trace) => trace.final || {});
  return {
    profile,
    traces: traces.length,
    turns: turns.length,
    policies: [...new Set(traces.map((trace) => trace.run?.policy).filter(Boolean))].sort(),
    meanFinalCoverage: round(mean(finals.map((final) => final.bestPathCoverage))),
    meanMissingPremises: round(mean(finals.map((final) => final.missingPremiseCount))),
    groundedClosures: finals.filter((final) => final.groundedClosure).length,
    meanConceptualScore: round(mean(turns.map((turn) => turn.classifier?.conceptualScore))),
    meanEpistemicReadinessScore: round(mean(turns.map((turn) => turn.classifier?.epistemicReadinessScore))),
    requestTypes: countBy(turns, (turn) => turn.classifier?.requestType),
    discourseMoves: countBy(turns, (turn) => turn.classifier?.discourseMove),
    evidenceUse: countBy(turns, (turn) => turn.classifier?.evidenceUse),
    epistemicStance: countBy(turns, (turn) => turn.classifier?.epistemicStance),
    agency: countBy(turns, (turn) => turn.classifier?.agency),
    affect: countBy(turns, (turn) => turn.classifier?.affect),
  };
}

function buildReport(compactedTraces, args, compactedWrites) {
  const byProfile = new Map();
  for (const trace of compactedTraces) {
    const profile = trace.run?.profile || 'unknown';
    if (!byProfile.has(profile)) byProfile.set(profile, []);
    byProfile.get(profile).push(trace);
  }

  const profileVectors = new Map();
  const profileSummaries = [];
  for (const [profile, traces] of [...byProfile.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    profileVectors.set(profile, combineVectors(traces.map(vectorForTrace)));
    profileSummaries.push(summarizeProfile(profile, traces));
  }

  const profiles = [...profileVectors.keys()];
  const pairwise = [];
  for (let i = 0; i < profiles.length; i++) {
    for (let j = i + 1; j < profiles.length; j++) {
      const a = profiles[i];
      const b = profiles[j];
      pairwise.push({
        a,
        b,
        pair: `${a} vs ${b}`,
        cosine: round(cosine(profileVectors.get(a), profileVectors.get(b))),
      });
    }
  }

  const averagePairwiseCosine = round(mean(pairwise.map((pair) => pair.cosine)));
  const maxPairwiseCosine = round(Math.max(...pairwise.map((pair) => pair.cosine).filter(Number.isFinite)));
  const controlPairs = pairwise.filter((pair) => pair.a === args.controlProfile || pair.b === args.controlProfile);
  const maxSimilarityToControl = controlPairs.length
    ? round(Math.max(...controlPairs.map((pair) => pair.cosine).filter(Number.isFinite)))
    : null;
  const closestPairs = [...pairwise].sort((a, b) => (b.cosine ?? -1) - (a.cosine ?? -1)).slice(0, 8);
  const mostSeparatedPairs = [...pairwise].sort((a, b) => (a.cosine ?? 2) - (b.cosine ?? 2)).slice(0, 8);

  const averagePass = averagePairwiseCosine != null && averagePairwiseCosine <= args.targetAverageCosine;
  const controlPass =
    maxSimilarityToControl == null ? null : maxSimilarityToControl <= args.targetMaxToControl;

  return {
    schema: 'machinespirits.tutor-stub.profile-discrimination.v1',
    generatedAt: new Date().toISOString(),
    input: {
      traceRoot: args.traceRoot || null,
      compactedRoot: args.compactedRoot || null,
      traces: compactedTraces.map((trace) => trace.sourceTrace || null).filter(Boolean),
      compactedWrites,
      vectorFields: [...VECTOR_FIELDS, 'conceptualScore', 'epistemicReadinessScore'],
    },
    summary: {
      traces: compactedTraces.length,
      profiles: profiles.length,
      turns: compactedTraces.reduce((sum, trace) => sum + (trace.turns || []).length, 0),
      averagePairwiseCosine,
      maxPairwiseCosine: Number.isFinite(maxPairwiseCosine) ? maxPairwiseCosine : null,
      controlProfile: args.controlProfile,
      maxSimilarityToControl,
    },
    gate: {
      targetAverageCosine: args.targetAverageCosine,
      targetMaxToControl: args.targetMaxToControl,
      averagePass,
      controlPass,
      pass: Boolean(averagePass && (controlPass === true || controlPass == null)),
    },
    profiles: profileSummaries,
    pairwise,
    closestPairs,
    mostSeparatedPairs,
  };
}

function formatObjectCounts(counts, max = 4) {
  return Object.entries(counts || {})
    .slice(0, max)
    .map(([key, value]) => `${key} ${value}`)
    .join(', ');
}

function formatMarkdown(report) {
  const lines = [];
  lines.push('# Tutor Stub Profile Discrimination');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Compacted traces: ${report.summary.traces}`);
  lines.push(`- Profiles: ${report.summary.profiles}`);
  lines.push(`- Turns: ${report.summary.turns}`);
  lines.push(`- Average pairwise cosine: ${report.summary.averagePairwiseCosine ?? 'n/a'}`);
  lines.push(`- Max pairwise cosine: ${report.summary.maxPairwiseCosine ?? 'n/a'}`);
  lines.push(
    `- Max similarity to ${report.summary.controlProfile}: ${report.summary.maxSimilarityToControl ?? 'n/a'}`,
  );
  lines.push(
    `- Gate: ${report.gate.pass ? 'pass' : 'fail'} (average <= ${report.gate.targetAverageCosine}; max-to-control <= ${report.gate.targetMaxToControl})`,
  );
  lines.push('');

  lines.push('## Profiles');
  lines.push('');
  lines.push('| Profile | Traces | Turns | Final coverage | Missing | Conceptual | Epistemic | Top evidence | Top stance | Top agency |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |');
  for (const profile of report.profiles) {
    lines.push(
      `| ${profile.profile} | ${profile.traces} | ${profile.turns} | ${profile.meanFinalCoverage ?? ''} | ${profile.meanMissingPremises ?? ''} | ${profile.meanConceptualScore ?? ''} | ${profile.meanEpistemicReadinessScore ?? ''} | ${formatObjectCounts(profile.evidenceUse, 2)} | ${formatObjectCounts(profile.epistemicStance, 2)} | ${formatObjectCounts(profile.agency, 2)} |`,
    );
  }
  lines.push('');

  lines.push('## Closest Pairs');
  lines.push('');
  lines.push('| Pair | Cosine |');
  lines.push('| --- | ---: |');
  for (const pair of report.closestPairs) {
    lines.push(`| ${pair.pair} | ${pair.cosine ?? ''} |`);
  }
  lines.push('');

  lines.push('## Most Separated Pairs');
  lines.push('');
  lines.push('| Pair | Cosine |');
  lines.push('| --- | ---: |');
  for (const pair of report.mostSeparatedPairs) {
    lines.push(`| ${pair.pair} | ${pair.cosine ?? ''} |`);
  }
  lines.push('');

  if (report.input.compactedWrites?.length) {
    lines.push('## Compacted Traces');
    lines.push('');
    for (const file of report.input.compactedWrites) lines.push(`- \`${file}\``);
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function collectInputs(args) {
  const traceFiles = [
    ...args.traces,
    ...walkFiles(args.traceRoot, (file) => file.endsWith('.jsonl')),
  ];
  const compactedFiles = [
    ...args.compacted,
    ...walkFiles(args.compactedRoot, (file) => file.endsWith('.json') && file.includes('compact-trace')),
  ];

  if (!traceFiles.length && !compactedFiles.length) {
    throw new Error('Provide --trace-root, --trace, --compacted-root, or --compacted');
  }

  return { traceFiles, compactedFiles };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const { traceFiles, compactedFiles } = collectInputs(args);
  const compactedTraces = [
    ...traceFiles.map((file) => compactTrace(file, args.traceRoot || path.dirname(file), args)),
    ...compactedFiles.map(readCompacted),
  ];

  const compactedWrites = [];
  if (args.writeCompacted) {
    const usedNames = new Set();
    for (const compacted of compactedTraces) {
      if (!compacted.sourceTrace || compactedFiles.includes(path.resolve(compacted.sourceTrace))) continue;
      compactedWrites.push(path.relative(ROOT, writeCompactedTrace(compacted, args.writeCompacted, usedNames)));
    }
  }

  const report = buildReport(compactedTraces, args, compactedWrites);
  const output = args.json ? `${JSON.stringify(report, null, 2)}\n` : formatMarkdown(report);

  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, output);
  } else {
    process.stdout.write(output);
  }
}

try {
  main();
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exit(1);
}
