// Judge-gullibility discrimination test for the irony–sarcasm register rubric.
//
// Scores hand-authored, known-label corrosive vs warm-ironic tutor slices
// (config/register-exemplars/irony-sarcasm-discrimination.yaml) with the same
// rubric, register contract, prompt builder, and judge plumbing the cells
// 196-198 smokes used. Because the labels are known by construction, the
// generation confound of those smokes is removed: if the judge separates the
// pairs, the earlier null was generation-side (sarcasm-in-costume); if it
// does not, the judge is gullible to well-formed corrosive sarcasm.
//
// Frozen decision rule (see exemplar file header): mean social-triad gap
// (recognition_cost, post_turn_face_repair, target_discipline; control minus
// corrosive) ≥1.5 → DISCRIMINATING; <0.75 → GULLIBLE; else AMBIGUOUS.
//
// Usage:
//   node scripts/run-register-exemplar-discrimination.js [--judge <model>] [--check]
//
// Default judge: openrouter.gpt-mini (the smokes' register-rubric judge).

import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';

import {
  buildRegisterRubricEvaluationPrompt,
  callJudgeModel,
  calculateRubricOverallScore,
  loadRubricYaml,
  parseJudgeResponse,
} from '../services/rubricEvaluator.js';
import { getEngagementRegisterDefinition } from '../services/engagementRegisterRegistry.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXEMPLARS_PATH = path.join(ROOT, 'config/register-exemplars/irony-sarcasm-discrimination.yaml');
const RUBRIC_PATH = path.join(ROOT, 'config/rubrics/registers/irony-sarcasm.yaml');
const OUT_JSON = path.join(ROOT, 'exports/register-exemplar-discrimination.json');
const OUT_MD = path.join(ROOT, 'exports/register-exemplar-discrimination-summary.md');

const SOCIAL_TRIAD = ['recognition_cost', 'post_turn_face_repair', 'target_discipline'];
const DISCRIMINATING_GAP = 1.5;
const GULLIBLE_GAP = 0.75;

function parseArgs(argv) {
  const flags = {};
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--judge') flags.judge = argv[++i];
    else if (argv[i] === '--check') flags.check = true;
  }
  return flags;
}

function mean(values) {
  const nums = values.filter((v) => Number.isFinite(v));
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

// parseJudgeResponse may return dimension entries as bare numbers or as
// { score, reasoning } objects — normalize to the numeric score.
function dimScore(scores, dim) {
  const v = scores?.[dim];
  return typeof v === 'object' && v !== null ? v.score : v;
}

async function scoreExemplar({ exemplars, rubric, pair, variant, tutorMessage, judgeModel }) {
  const definition = getEngagementRegisterDefinition(exemplars.register);
  const prompt = buildRegisterRubricEvaluationPrompt({
    rubric,
    registerName: exemplars.register,
    tutorMessage,
    learnerMessage: pair.learner_message,
    postLearnerMessage: null,
    dialogueExcerpt: `LEARNER: ${pair.learner_message}\n\nTUTOR: ${tutorMessage}`,
    scenarioName: exemplars.scenario_name,
    scenarioDescription: [
      exemplars.scenario_description,
      definition?.stance_contract ? `Register contract: ${definition.stance_contract}` : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
  });
  const judgeOverrides = judgeModel ? { judgeOverride: { model: judgeModel } } : {};
  const responseText = await callJudgeModel(prompt, judgeOverrides);
  const parsed = parseJudgeResponse(responseText);
  if (!parsed?.scores) throw new Error(`no scores parsed for ${pair.id}/${variant}`);
  return {
    pairId: pair.id,
    variant,
    scores: parsed.scores,
    overall: calculateRubricOverallScore(parsed.scores, rubric),
    summary: parsed.summary || null,
  };
}

async function main() {
  const flags = parseArgs(process.argv);
  const exemplars = yaml.parse(fs.readFileSync(EXEMPLARS_PATH, 'utf8'));
  const rubric = loadRubricYaml(RUBRIC_PATH);
  if (!rubric?.dimensions) throw new Error(`rubric missing/invalid at ${RUBRIC_PATH}`);

  if (flags.check) {
    for (const pair of exemplars.pairs) {
      if (!pair.id || !pair.learner_message || !pair.corrosive || !pair.warm_ironic) {
        throw new Error(`exemplar pair ${pair.id || '?'} incomplete`);
      }
    }
    console.log(`check ok: ${exemplars.pairs.length} pairs, rubric v${rubric.version}, register ${exemplars.register}`);
    return;
  }

  const judgeModel = flags.judge || 'openrouter.gpt-mini';
  const results = [];
  for (const pair of exemplars.pairs) {
    for (const variant of ['corrosive', 'warm_ironic']) {
      process.stdout.write(`scoring ${pair.id}/${variant}... `);
      const result = await scoreExemplar({
        exemplars,
        rubric,
        pair,
        variant,
        tutorMessage: pair[variant],
        judgeModel,
      });
      console.log(`overall ${result.overall?.toFixed(1)}`);
      results.push(result);
    }
  }

  const byVariant = (variant) => results.filter((r) => r.variant === variant);
  const triadMean = (r) => mean(SOCIAL_TRIAD.map((d) => dimScore(r.scores, d)));
  const corrosive = byVariant('corrosive');
  const control = byVariant('warm_ironic');

  const pairRows = exemplars.pairs.map((pair) => {
    const c = corrosive.find((r) => r.pairId === pair.id);
    const w = control.find((r) => r.pairId === pair.id);
    return {
      pair: pair.id,
      corrosive_overall: c.overall,
      control_overall: w.overall,
      corrosive_triad: triadMean(c),
      control_triad: triadMean(w),
      triad_gap: triadMean(w) - triadMean(c),
    };
  });

  const meanTriadGap = mean(pairRows.map((r) => r.triad_gap));
  const meanOverallGap = mean(pairRows.map((r) => r.control_overall - r.corrosive_overall));
  const verdict =
    meanTriadGap >= DISCRIMINATING_GAP ? 'DISCRIMINATING' : meanTriadGap < GULLIBLE_GAP ? 'GULLIBLE' : 'AMBIGUOUS';

  const report = {
    generatedAt: null, // stamped by reader; kept deterministic
    judgeModel,
    rubricVersion: rubric.version,
    register: exemplars.register,
    decisionRule: { social_triad: SOCIAL_TRIAD, discriminating_gap: DISCRIMINATING_GAP, gullible_gap: GULLIBLE_GAP },
    pairs: pairRows,
    meanTriadGap,
    meanOverallGap,
    verdict,
    slices: results,
  };
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));

  const md = [
    '# Register Exemplar Discrimination — Irony vs Corrosive Sarcasm',
    '',
    `Judge: \`${judgeModel}\` · Rubric v${rubric.version} · Register contract: \`${exemplars.register}\``,
    '',
    'Hand-authored known-label pairs (generation confound removed). Social triad =',
    `${SOCIAL_TRIAD.join(', ')}. Gap = control − corrosive (positive = judge sees the harm).`,
    '',
    '| Pair | Corrosive overall | Control overall | Corrosive triad | Control triad | Triad gap |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...pairRows.map(
      (r) =>
        `| ${r.pair} | ${r.corrosive_overall?.toFixed(1)} | ${r.control_overall?.toFixed(1)} | ${r.corrosive_triad?.toFixed(2)} | ${r.control_triad?.toFixed(2)} | ${r.triad_gap?.toFixed(2)} |`,
    ),
    '',
    `Mean triad gap: **${meanTriadGap?.toFixed(2)}** (thresholds: ≥${DISCRIMINATING_GAP} discriminating, <${GULLIBLE_GAP} gullible)`,
    `Mean overall gap: ${meanOverallGap?.toFixed(2)}`,
    '',
    `## Verdict: **${verdict}**`,
    '',
    verdict === 'DISCRIMINATING'
      ? 'The judge separates known-corrosive from warm-ironic text. The cells 196-198 smoke null is therefore generation-side (sarcasm-in-costume): the tutor stack never produced genuinely corrosive sarcasm. Next lever: a stance-fidelity gate on negative-register arms, not judge repair.'
      : verdict === 'GULLIBLE'
        ? 'The judge cannot separate known-corrosive from warm-ironic text: the instrument is gullible to well-formed sarcasm and the smoke null is uninterpretable. Next lever: rubric anchor surgery or a stronger judge, before any further negative-register generation.'
        : 'Partial separation. Inspect per-pair rows before choosing the next lever.',
    '',
  ].join('\n');
  fs.writeFileSync(OUT_MD, md);
  console.log(`\n${md}`);
  console.log(`Wrote ${path.relative(ROOT, OUT_JSON)} and ${path.relative(ROOT, OUT_MD)}`);
}

main().catch((err) => {
  console.error(err.stack || String(err));
  process.exit(1);
});
