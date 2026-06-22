#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_MATRIX_DIR = path.join(ROOT, 'exports/dramatic-derivation/cast-layer-local-gate/matrix');
const DEFAULT_OUT_DIR = path.join(ROOT, 'exports/dramatic-derivation/cast-layer-reader-quality');

const CONDITIONS = Object.freeze([
  { id: 'S0', label: 'cast-layer-local-s0-no-cast', name: 'no cast' },
  { id: 'S1', label: 'cast-layer-local-s1-static-cast', name: 'static cast' },
  { id: 'S2', label: 'cast-layer-local-s2-reinvention', name: 'cast + reinvention' },
]);

const FORMALISM_RE = /\b[a-z]+[A-Z][A-Za-z0-9]*\b|\?[a-zA-Z_][a-zA-Z0-9_]*|[a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\)|\bD\s*=\s*\d/u;
const ACK_RE = /\b(i see|yes|i am listening|i follow|i take|no,? sorry|that much|nothing new)\b/iu;
const QUESTION_RE = /\?/u;

function usage() {
  return `Usage:
  node scripts/evaluate-cast-layer-reader-quality.js \\
    [--matrix-dir exports/dramatic-derivation/cast-layer-local-gate/matrix] \\
    [--out-dir exports/dramatic-derivation/cast-layer-reader-quality]
`;
}

export function parseArgs(argv = []) {
  const opts = {
    matrixDir: DEFAULT_MATRIX_DIR,
    outDir: DEFAULT_OUT_DIR,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return { ...opts, help: true };
    if (arg === '--matrix-dir') {
      opts.matrixDir = path.resolve(ROOT, argv[++i]);
      continue;
    }
    if (arg === '--out-dir') {
      opts.outDir = path.resolve(ROOT, argv[++i]);
      continue;
    }
    throw new Error(`Unknown argument ${arg}\n${usage()}`);
  }
  return opts;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

function mean(values) {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (!filtered.length) return null;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function weightedOverall(dimensions) {
  let weighted = 0;
  let weightSum = 0;
  for (const dimension of Object.values(dimensions)) {
    if (!Number.isFinite(dimension.score)) continue;
    weighted += dimension.score * dimension.weight;
    weightSum += dimension.weight;
  }
  if (!weightSum) return null;
  return round(((weighted / weightSum - 1) / 4) * 100, 1);
}

function flattenPublicLines(live) {
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

function countUnique(values) {
  return new Set(values.filter((value) => value !== null && value !== undefined)).size;
}

function textStats(live) {
  const lines = flattenPublicLines(live);
  const tutorLines = lines.filter((line) => line.role === 'tutor');
  const learnerLines = lines.filter((line) => line.role === 'learner');
  const stageLines = lines.filter((line) => line.role === 'stage');
  const formalismLeaks = lines.filter((line) => FORMALISM_RE.test(line.text));
  const acknowledgements = learnerLines.filter((line) => ACK_RE.test(line.text));
  const substantiveLearner = learnerLines.filter((line) =>
    ['hypothesis', 'substantive', 'assertion'].includes(line.exchangeType) ||
    /\b(settles|shown|shown:|take what has been shown|adopts?|asserts?)\b/iu.test(line.text),
  );
  const uniqueTutorTexts = countUnique(tutorLines.map((line) => line.text.toLowerCase()));
  const uniqueLearnerTexts = countUnique(learnerLines.map((line) => line.text.toLowerCase()));
  const avgTutorWords = mean(tutorLines.map((line) => line.text.split(/\s+/u).filter(Boolean).length)) || 0;
  const avgLearnerWords = mean(learnerLines.map((line) => line.text.split(/\s+/u).filter(Boolean).length)) || 0;
  const questionRatio = tutorLines.length
    ? tutorLines.filter((line) => QUESTION_RE.test(line.text)).length / tutorLines.length
    : 0;
  return {
    lineCount: lines.length,
    tutorLineCount: tutorLines.length,
    learnerLineCount: learnerLines.length,
    stageLineCount: stageLines.length,
    formalismLeaks,
    acknowledgementCount: acknowledgements.length,
    phaticLearnerCount: learnerLines.filter((line) => line.exchangeType === 'phatic_ack').length,
    substantiveLearnerCount: substantiveLearner.length,
    uniqueTutorTexts,
    uniqueLearnerTexts,
    avgTutorWords: round(avgTutorWords),
    avgLearnerWords: round(avgLearnerWords),
    questionRatio: round(questionRatio, 3),
    finalLearnerLine: learnerLines.at(-1)?.text || '',
    sampleAcknowledgement: acknowledgements[0]?.text || null,
    sampleQuestion: tutorLines.find((line) => QUESTION_RE.test(line.text))?.text || null,
  };
}

function summarizeArtifact(condition, matrixDir) {
  const dir = path.join(matrixDir, condition.label);
  const live = readJson(path.join(dir, 'live.json'));
  const result = readJson(path.join(dir, 'result.json'));
  const diagnosis = readJson(path.join(dir, 'diagnosis.json'));
  const castEntries = Array.isArray(result.castLayer) ? result.castLayer : [];
  const reinventionEntries = castEntries.filter((entry) => entry.reinvention?.active);
  const finalTurn = Array.isArray(live.turns) ? live.turns.at(-1) : null;
  const releaseAdherence = diagnosis.releaseAdherence || {};
  return {
    ...condition,
    dir,
    live,
    result,
    diagnosis,
    stats: textStats(live),
    summary: {
      verdict: result.verdict,
      turnsPlayed: result.turnsPlayed ?? diagnosis.turnsPlayed ?? live.turns?.length ?? null,
      firstForcedTurn: result.firstForcedTurn ?? diagnosis.firstForcedTurn ?? null,
      assertedGroundedTurn: result.assertedGroundedTurn ?? diagnosis.assertedGroundedTurn ?? null,
      finalD: finalTurn?.D ?? null,
      dCurve: diagnosis.dCurve || (Array.isArray(live.turns) ? live.turns.map((turn) => turn.D) : []),
      releaseDeviationCount:
        (releaseAdherence.deviations?.length || 0) +
        (releaseAdherence.missed?.length || 0) +
        (releaseAdherence.unscheduled?.length || 0),
      castEnabled: diagnosis.castLayer === true,
      reinventionEnabled: diagnosis.castReinvention === true,
      castTurns: castEntries.length,
      reinventionTurns: reinventionEntries.map((entry) => ({
        turn: entry.turn,
        trigger: entry.reinvention.trigger,
        fromStance: entry.reinvention.fromStance,
        toStance: entry.reinvention.toStance,
        mayOverrideProofControl: entry.reinvention.mayOverrideProofControl,
      })),
      allCastAuditsOk: castEntries.every((entry) => entry.inputAuditOk && entry.nonLeakAuditOk),
      anyProofOverride: castEntries.some((entry) => entry.mayOverrideProofControl || entry.reinvention?.mayOverrideProofControl),
      learnerPostures: [...new Set(castEntries.map((entry) => entry.learnerPosture).filter(Boolean))],
      tutorStances: [...new Set(castEntries.map((entry) => entry.tutorStance).filter(Boolean))],
    },
  };
}

function sameArray(a = [], b = []) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function proofInvariantScore(artifact, baseline) {
  const same =
    artifact.summary.verdict === baseline.summary.verdict &&
    artifact.summary.turnsPlayed === baseline.summary.turnsPlayed &&
    artifact.summary.firstForcedTurn === baseline.summary.firstForcedTurn &&
    artifact.summary.assertedGroundedTurn === baseline.summary.assertedGroundedTurn &&
    artifact.summary.finalD === baseline.summary.finalD &&
    sameArray(artifact.summary.dCurve, baseline.summary.dCurve) &&
    artifact.summary.releaseDeviationCount === 0;
  return same ? 5 : artifact.summary.releaseDeviationCount === 0 ? 3 : 1;
}

function scoreV22Proxy(artifact) {
  const stats = artifact.stats;
  const hasFinalAssertion = /shown/i.test(stats.finalLearnerLine);
  const hasReinvention = artifact.summary.reinventionTurns.length > 0;
  const hasCast = artifact.summary.castEnabled;
  const formalismClean = stats.formalismLeaks.length === 0;
  const phaticRatio = stats.learnerLineCount ? stats.phaticLearnerCount / stats.learnerLineCount : 0;
  const substantiveRatio = stats.learnerLineCount ? stats.substantiveLearnerCount / stats.learnerLineCount : 0;
  return {
    perception_quality: {
      weight: 0.15,
      score: hasCast ? 3 : 2.5,
      evidence: hasCast ? `Learner posture tracked as ${artifact.summary.learnerPostures.join(', ') || 'ordinary'}.` : 'No cast-state learner posture is available.',
    },
    pedagogical_craft: {
      weight: 0.2,
      score: stats.avgTutorWords <= 26 && stats.questionRatio >= 0.4 ? 3.5 : 3,
      evidence: `Average tutor line ${stats.avgTutorWords} words; question ratio ${stats.questionRatio}.`,
    },
    elicitation_quality: {
      weight: 0.15,
      score: stats.questionRatio >= 0.5 ? 4 : 3,
      evidence: stats.sampleQuestion || 'Tutor questioning not detected.',
    },
    adaptive_responsiveness: {
      weight: 0.15,
      score: hasReinvention ? 3.5 : hasCast ? 3 : 2.5,
      evidence: hasReinvention
        ? `Reinvention at t${artifact.summary.reinventionTurns.map((turn) => turn.turn).join(', t')}.`
        : hasCast
          ? 'Cast posture is tracked, but no stance change occurs.'
          : 'No cast or reinvention signal is active.',
    },
    recognition_quality: {
      weight: 0.15,
      score: stats.acknowledgementCount >= 4 && hasCast ? 3 : 2.5,
      evidence: stats.sampleAcknowledgement || 'No learner acknowledgement sample found.',
    },
    productive_difficulty: {
      weight: 0.1,
      score: hasFinalAssertion && substantiveRatio >= 0.5 ? 3.5 : 3,
      evidence: `Substantive learner ratio ${round(substantiveRatio, 2)}; final line: "${stats.finalLearnerLine}".`,
    },
    epistemic_integrity: {
      weight: 0.05,
      score: formalismClean ? 4 : 2,
      evidence: formalismClean ? 'No raw formalism detected in public tutor/learner/stage lines.' : `${stats.formalismLeaks.length} formalism-like public line(s) detected.`,
    },
    content_accuracy: {
      weight: 0.05,
      score: artifact.summary.verdict === 'grounded_anagnorisis' ? 4 : 2,
      evidence: `Runtime verdict: ${artifact.summary.verdict}.`,
    },
  };
}

function scoreDialogueProxy(artifact) {
  const stats = artifact.stats;
  const substantiveRatio = stats.learnerLineCount ? stats.substantiveLearnerCount / stats.learnerLineCount : 0;
  const uniqueLearnerRatio = stats.learnerLineCount ? stats.uniqueLearnerTexts / stats.learnerLineCount : 0;
  const hasFinalAssertion = /shown/i.test(stats.finalLearnerLine);
  return {
    pedagogical_progression: {
      weight: 0.2,
      score: artifact.summary.finalD === 0 ? 4 : 2,
      evidence: `D curve reaches ${artifact.summary.finalD}; verdict ${artifact.summary.verdict}.`,
    },
    dialogical_responsiveness: {
      weight: 0.2,
      score: stats.questionRatio >= 0.45 && substantiveRatio >= 0.45 ? 3 : 2.5,
      evidence: `Tutor question ratio ${stats.questionRatio}; substantive learner ratio ${round(substantiveRatio, 2)}.`,
    },
    knowledge_co_construction: {
      weight: 0.2,
      score: substantiveRatio >= 0.55 ? 3.5 : 3,
      evidence: `Learner contributes substantive/hypothesis/assertion lines on ${stats.substantiveLearnerCount}/${stats.learnerLineCount} turns.`,
    },
    productive_tension_management: {
      weight: 0.15,
      score: artifact.summary.learnerPostures.includes('defensive_after_correction') && artifact.summary.reinventionTurns.length ? 3.5 : 3,
      evidence: artifact.summary.reinventionTurns.length
        ? 'Defensive posture is met by a bounded stance change.'
        : 'Defensive posture is present but no stance change is active.',
    },
    transformation_evidence: {
      weight: 0.15,
      score: hasFinalAssertion ? 3.5 : 2.5,
      evidence: `Final learner line: "${stats.finalLearnerLine}".`,
    },
    interactional_coherence: {
      weight: 0.1,
      score: uniqueLearnerRatio < 0.5 ? 2.5 : 3,
      evidence: `Unique learner utterance ratio ${round(uniqueLearnerRatio, 2)}; repetition remains visible.`,
    },
  };
}

function scorePoeticsProxy(artifact) {
  const stats = artifact.stats;
  const hasFinalAssertion = /shown/i.test(stats.finalLearnerLine);
  const sceneCount = countUnique(artifact.live.turns?.map((turn) => turn.scene?.index) || []);
  return {
    peripeteia: {
      weight: 0.2,
      score: hasFinalAssertion ? 3 : 2,
      evidence: hasFinalAssertion ? `The close changes from inquiry to assertion: "${stats.finalLearnerLine}".` : 'No asserted turn is visible.',
    },
    anagnorisis: {
      weight: 0.2,
      score: hasFinalAssertion ? 3 : 2,
      evidence: hasFinalAssertion ? `The learner names the answer in public: "${stats.finalLearnerLine}".` : 'No learner-owned recognition event is visible.',
    },
    surprise_and_inevitability: {
      weight: 0.15,
      score: 2,
      evidence: 'The proof arc is coherent, but the repeated template makes the final recognition highly signposted.',
    },
    unity_of_action: {
      weight: 0.15,
      score: sceneCount >= 5 && artifact.summary.finalD === 0 ? 3.5 : 3,
      evidence: `${sceneCount} scenes follow the same inquiry to D=${artifact.summary.finalD}.`,
    },
    hamartia_integration: {
      weight: 0.15,
      score: 2.5,
      evidence: 'The learner error is represented mainly as staged proof debt, not as a richly enacted dramatic flaw.',
    },
    cathartic_closure: {
      weight: 0.15,
      score: hasFinalAssertion ? 3 : 2,
      evidence: hasFinalAssertion ? `Closure lands as a grounded but terse assertion: "${stats.finalLearnerLine}".` : 'No closure line found.',
    },
  };
}

function scoreDerivativeCriteria(artifact, baseline) {
  const stats = artifact.stats;
  const hasCast = artifact.summary.castEnabled;
  const hasReinvention = artifact.summary.reinventionEnabled;
  const reinventions = artifact.summary.reinventionTurns;
  const proofScore = proofInvariantScore(artifact, baseline);
  const nonLeakScore = stats.formalismLeaks.length === 0 && !artifact.summary.anyProofOverride && artifact.summary.allCastAuditsOk ? 5 : 2;
  const boundedReinventionScore = !hasReinvention
    ? null
    : reinventions.length === 1 && reinventions.every((turn) => turn.mayOverrideProofControl === false)
      ? 5
      : reinventions.length > 0
        ? 3
        : 1;
  return {
    proof_control_invariance: {
      weight: 0.22,
      score: proofScore,
      evidence: `Verdict ${artifact.summary.verdict}; turns ${artifact.summary.turnsPlayed}; final D ${artifact.summary.finalD}; release deviations ${artifact.summary.releaseDeviationCount}.`,
    },
    public_nonleak_safety: {
      weight: 0.18,
      score: nonLeakScore,
      evidence: stats.formalismLeaks.length === 0 ? 'No public formalism leaks detected and cast audits remain clean.' : `${stats.formalismLeaks.length} public formalism-like line(s) detected.`,
    },
    cast_visibility: {
      weight: 0.16,
      score: hasCast ? 4 : 1,
      evidence: hasCast ? `${artifact.summary.castTurns} cast-state rows with tutor/learner/relation projections.` : 'No cast state is emitted.',
    },
    character_coherence: {
      weight: 0.14,
      score: hasCast ? 3 : 2,
      evidence: hasCast
        ? `Stable roles: tutor stances ${artifact.summary.tutorStances.join(', ')}; learner postures ${artifact.summary.learnerPostures.join(', ')}.`
        : 'Public transcript has no authored role state beyond generic opening notes.',
    },
    bounded_reinvention: {
      weight: 0.15,
      score: boundedReinventionScore,
      evidence: hasReinvention
        ? reinventions.map((turn) => `t${turn.turn}: ${turn.fromStance} -> ${turn.toStance} (${turn.trigger})`).join('; ') || 'Reinvention enabled but no event fired.'
        : 'Not applicable: reinvention disabled.',
    },
    reader_quality_delta: {
      weight: 0.15,
      score: hasCast ? 2.5 : 2,
      evidence: 'Mock public prose is effectively unchanged across arms, so reader-quality improvement is not established.',
    },
  };
}

function scoreArtifact(artifact, baseline) {
  const v22 = scoreV22Proxy(artifact);
  const dialogue = scoreDialogueProxy(artifact);
  const poetics = scorePoeticsProxy(artifact);
  const derivative = scoreDerivativeCriteria(artifact, baseline);
  return {
    id: artifact.id,
    label: artifact.label,
    name: artifact.name,
    summary: artifact.summary,
    stats: artifact.stats,
    rubrics: {
      tutor_v2_2_proxy: {
        rubric: 'config/evaluation-rubric.yaml',
        confidence: 'low-to-moderate heuristic proxy; not an LLM or human judge',
        overall: weightedOverall(v22),
        dimensions: v22,
      },
      dialogue_quality_proxy: {
        rubric: 'config/evaluation-rubric-dialogue.yaml',
        confidence: 'low-to-moderate heuristic proxy; not an LLM or human judge',
        overall: weightedOverall(dialogue),
        dimensions: dialogue,
      },
      poetics_proxy: {
        rubric: 'config/evaluation-rubric-poetics.yaml',
        confidence: 'low heuristic proxy; dramatic-form evidence is thin in the mock transcript',
        overall: weightedOverall(poetics),
        dimensions: poetics,
      },
      derivative_branch_criteria: {
        rubric: 'cast-layer branch criteria, public conduct/discourse layer',
        confidence: 'moderate for runtime invariants; low for reader-preference claims',
        overall: weightedOverall(derivative),
        dimensions: derivative,
      },
    },
  };
}

function table(rows, columns) {
  const header = `| ${columns.map((col) => col.title).join(' | ')} |`;
  const sep = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${columns.map((col) => col.render(row)).join(' | ')} |`);
  return [header, sep, ...body].join('\n');
}

function renderScoreList(dimensions) {
  return Object.entries(dimensions)
    .map(([key, dim]) => `- \`${key}\`: ${dim.score === null ? 'n/a' : dim.score}/5 — ${dim.evidence}`)
    .join('\n');
}

function renderReport(scores, outDir, matrixDir) {
  const rows = scores.map((score) => ({
    ...score,
    v22: score.rubrics.tutor_v2_2_proxy.overall,
    dialogue: score.rubrics.dialogue_quality_proxy.overall,
    poetics: score.rubrics.poetics_proxy.overall,
    derivative: score.rubrics.derivative_branch_criteria.overall,
  }));
  const scoreTable = table(rows, [
    { title: 'Condition', render: (row) => `${row.id} ${row.name}` },
    { title: 'Verdict', render: (row) => `\`${row.summary.verdict}\`` },
    { title: 'Turns', render: (row) => String(row.summary.turnsPlayed) },
    { title: 'Final D', render: (row) => String(row.summary.finalD) },
    { title: 'v2.2 proxy', render: (row) => String(row.v22) },
    { title: 'Dialogue proxy', render: (row) => String(row.dialogue) },
    { title: 'Poetics proxy', render: (row) => String(row.poetics) },
    { title: 'Branch criteria', render: (row) => String(row.derivative) },
  ]);
  const methodTable = table(rows, [
    { title: 'Condition', render: (row) => `${row.id}` },
    { title: 'Cast rows', render: (row) => String(row.summary.castTurns) },
    { title: 'Reinvention turns', render: (row) => row.summary.reinventionTurns.map((turn) => `t${turn.turn}`).join(', ') || 'none' },
    { title: 'Formalism leaks', render: (row) => String(row.stats.formalismLeaks.length) },
    { title: 'Question ratio', render: (row) => String(row.stats.questionRatio) },
    { title: 'Unique learner lines', render: (row) => `${row.stats.uniqueLearnerTexts}/${row.stats.learnerLineCount}` },
  ]);

  const details = scores
    .map((score) => `### ${score.id} ${score.name}

**v2.2 proxy dimensions**
${renderScoreList(score.rubrics.tutor_v2_2_proxy.dimensions)}

**Dialogue-quality proxy dimensions**
${renderScoreList(score.rubrics.dialogue_quality_proxy.dimensions)}

**Poetics proxy dimensions**
${renderScoreList(score.rubrics.poetics_proxy.dimensions)}

**Derivative branch criteria**
${renderScoreList(score.rubrics.derivative_branch_criteria.dimensions)}
`)
    .join('\n');

  return `# Cast Layer Reader-Quality Evaluation

Date: ${new Date().toISOString().slice(0, 10)}

## Scope

This is a local, zero-paid evaluation of the existing S0/S1/S2 Hethel cast-layer mock artifacts under:

- \`config/evaluation-rubric.yaml\` v2.2 tutor-quality dimensions, as a heuristic transcript/runtime proxy.
- \`config/evaluation-rubric-dialogue.yaml\` dialogue-quality dimensions, as a heuristic transcript proxy.
- \`config/evaluation-rubric-poetics.yaml\` dramatic-form dimensions, as a conservative heuristic proxy.
- Derivative branch criteria for the cast/reinvention layer: proof-control invariance, public non-leak safety, cast visibility, character coherence, bounded reinvention, and reader-quality delta.

These are not LLM-judge or human-reader scores. The current backend is mock/deterministic, and S0/S1/S2 public prose is almost unchanged. Treat the branch criteria as the firmer evidence surface and the older-rubric scores as provisional diagnostics.

Artifacts scored from: \`${path.relative(ROOT, matrixDir)}\`  
Output directory: \`${path.relative(ROOT, outDir)}\`

## Overall Scores

Scores are converted from 1-5 dimension anchors to 0-100 using the project convention: \`((weighted_avg - 1) / 4) * 100\`.

${scoreTable}

## Diagnostic Surface

${methodTable}

## Interpretation

The meaningful result is not a reader-preference win. The mock transcripts remain too repetitive and too similar across S0/S1/S2 to support that claim. The useful signal is narrower:

- Proof reliability is unchanged across all three conditions: same verdict, turn count, final D, forced/asserted turn, D curve, and release adherence.
- S1 proves the public cast state can be carried without proof-control harm.
- S2 proves one bounded reinvention event can fire under defensive posture and then clear without altering release timing or assertion authority.
- Earlier quality rubrics do not yet show a material discourse-quality gain; the v2.2/dialogue/poetics proxy scores are nearly flat because the public text is nearly flat.

So the cast layer is mature as instrumentation and a safety-bounded conduct layer, but not yet mature as demonstrated reader-quality improvement. The next meaningful evaluation would need either a real-backend paired transcript comparison or a stronger local mock that lets cast/reinvention change public wording while holding proof state fixed.

## Condition Details

${details}

## Commands

\`\`\`bash
node scripts/evaluate-cast-layer-reader-quality.js
node --test tests/castLayerReaderQualityEval.test.js
\`\`\`
`;
}

export function evaluateCastLayerReaderQuality({ matrixDir = DEFAULT_MATRIX_DIR, outDir = DEFAULT_OUT_DIR } = {}) {
  const artifacts = CONDITIONS.map((condition) => summarizeArtifact(condition, matrixDir));
  const baseline = artifacts[0];
  const scores = artifacts.map((artifact) => scoreArtifact(artifact, baseline));
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'scores.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), matrixDir, scores }, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'report.md'), renderReport(scores, outDir, matrixDir));
  return { outDir, scores };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      process.stdout.write(usage());
      process.exit(0);
    }
    const result = evaluateCastLayerReaderQuality(args);
    process.stdout.write(`Wrote ${path.relative(ROOT, result.outDir)}/report.md\n`);
  } catch (err) {
    console.error(err?.stack || err?.message || err);
    process.exit(1);
  }
}
