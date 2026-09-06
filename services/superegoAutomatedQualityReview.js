import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import { isDeepStrictEqual } from 'node:util';
import { DESIGN_PATH, ARMS, UNKNOWN, PROMPTS, validRating, reservationCost } from './superegoContemporaryPilot.js';
import { sha256 } from './superegoCritiqueCausalReplay.js';
import { contrast } from './superegoHumanQualityReview.js';

export function loadAutomatedQualityDesign(root) {
  const source = fs.readFileSync(path.join(root, DESIGN_PATH), 'utf8');
  const block = source.match(/```yaml automated_quality\n([\s\S]*?)\n```/u);
  if (!block) throw new Error('Missing automated quality registration');
  return yaml.parse(block[1]);
}

export function prepareAutomatedQuality(design, sourcePlan, packet, sourceDesign) {
  const { packet_id: packetId, ...data } = packet;
  const route = design.models.judging;
  if (
    packetId !== sha256(JSON.stringify(data)) ||
    packetId !== design.source_packet_id ||
    packet.study_id !== design.source_study_id ||
    packet.study_id !== sourcePlan.study_id ||
    packet.category !== 'quality' ||
    packet.instructions !== PROMPTS.quality ||
    packet.items.length !== design.attempts.quality_planned ||
    packet.items.some((item) => item.unavailable) ||
    new Set(packet.items.map((item) => item.id)).size !== packet.items.length ||
    !isDeepStrictEqual(
      packet.items.map((item) => item.id),
      sourcePlan.presentations.quality.map((item) => item.id),
    )
  )
    throw new Error('Automated review requires the exact complete sealed human quality packet');
  if (
    route.provider !== 'codex' ||
    route.model !== 'gpt-5.6-sol' ||
    route.model === sourceDesign.models.generation.model ||
    route.provider === sourceDesign.models.generation.provider ||
    design.id === sourcePlan.study_id ||
    design.master_seed !== sourcePlan.seed ||
    design.sample_size !== sourcePlan.units.length ||
    design.attempts.generation_planned !== 0 ||
    design.attempts.semantic_planned !== 0 ||
    design.attempts.generation_reserve !== 0 ||
    design.attempts.semantic_reserve !== 0 ||
    design.attempts.total_planned !== packet.items.length ||
    !Number.isInteger(design.attempts.quality_reserve) ||
    design.attempts.quality_reserve < 1 ||
    design.attempts.quality_reserve !== design.attempts.recovery_reserve ||
    design.attempts.total_planned + design.attempts.recovery_reserve !== design.attempts.hard_ceiling ||
    design.max_dollars !== 0 ||
    route.input_per_million !== 0 ||
    route.output_per_million !== 0 ||
    reservationCost(design, 'quality') * design.attempts.hard_ceiling > design.max_dollars + 1e-9
  )
    throw new Error('Invalid quality-only scope, separation or ceilings');
  return {
    study_id: design.id,
    seed: design.master_seed,
    units: sourcePlan.units,
    presentations: { quality: sourcePlan.presentations.quality },
    jobs: sourcePlan.presentations.quality.map((out) => ({
      id: `${out.unit}/${out.arm}/quality`,
      unit: out.unit,
      arm: out.arm,
      category: 'quality',
      kind: 'quality',
      presentation_id: out.id,
    })),
    automated_quality_packet: packet,
  };
}

export function automatedQualityRatings(design, plan, results) {
  return {
    study_id: design.id,
    source_study_id: design.source_study_id,
    packet_id: design.source_packet_id,
    rater_type: 'model',
    model: design.models.judging,
    ratings: plan.jobs.map((job) => {
      const result = results.get(job.id);
      return {
        id: job.presentation_id,
        disposition: !result ? 'missing' : result.invalid_response || 'rated',
        rating: result && !result.invalid_response ? result : null,
      };
    }),
  };
}

export function validateAutomatedQualityRatings(packet, document) {
  if (
    document.rater_type !== 'model' ||
    document.source_study_id !== packet.study_id ||
    document.packet_id !== packet.packet_id ||
    document.ratings?.length !== packet.items.length ||
    new Set(document.ratings.map((row) => row.id)).size !== packet.items.length
  )
    throw new Error('Model ratings do not match the human packet');
  for (const item of packet.items) {
    const row = document.ratings.find((r) => r.id === item.id);
    if (!row || (row.disposition === 'rated' ? !validRating('quality', row.rating, item) : row.rating !== null))
      throw new Error(`Invalid model rating: ${item.id}`);
  }
  return document;
}

// Matched response IDs, never merely similar contexts. N/A and indeterminate
// ratings are retained as categories and excluded only from numeric statistics.
export function readerAgreement(left, right, ids, field) {
  const rows = ids.map((id) => {
    const a = left.find((r) => r.id === id)?.rating?.[field] ?? null;
    const b = right.find((r) => r.id === id)?.rating?.[field] ?? null;
    return { id, left: a, right: b, consensus: a !== null && a !== UNKNOWN && a === b ? a : UNKNOWN };
  });
  const known = rows.filter((r) => Number.isInteger(r.left) && Number.isInteger(r.right));
  const numeric = (fn) => (known.length ? known.reduce((sum, r) => sum + fn(r), 0) / known.length : null);
  return {
    field,
    planned: ids.length,
    numeric_pairs: known.length,
    exact_numeric_agreement: numeric((r) => Number(r.left === r.right)),
    within_one_point_agreement: numeric((r) => Number(Math.abs(r.left - r.right) <= 1)),
    mean_absolute_difference: numeric((r) => Math.abs(r.left - r.right)),
    mean_left_minus_right: numeric((r) => r.left - r.right),
    indeterminate_consensus: rows.filter((r) => r.consensus === UNKNOWN).length,
    rows,
  };
}

export function summarizeAutomatedQuality(plan, packet, document, humans = null) {
  validateAutomatedQualityRatings(packet, document);
  const arms = ARMS.filter((arm) => arm !== 'generic_revision');
  const report = {
    study_id: document.study_id,
    source_study_id: packet.study_id,
    packet_id: packet.packet_id,
    claim_status: 'descriptive_model_quality_assessment',
    primary_endpoint: 'blind public quality, actual critique minus generic revision',
    meaningful_difference: 1,
    model: document.model,
    planned_ratings: packet.items.length,
    accepted_ratings: document.ratings.filter((row) => row.disposition === 'rated').length,
    contrasts: arms.map((arm) =>
      contrast(plan, (id) => document.ratings.find((r) => r.id === id)?.rating?.quality, arm),
    ),
    ratings: document.ratings,
    human_comparison: null,
    semantic_measurement: 'not_collected',
    learner_or_transfer_evidence: null,
  };
  if (humans) {
    if (humans.study_id !== packet.study_id || humans.packet_id !== packet.packet_id || humans.raters.length !== 2)
      throw new Error('Human/model comparison requires the same validated human packet');
    const ids = packet.items.map((item) => item.id);
    const readers = [...humans.raters, { coder_id: 'automated_model', ratings: document.ratings }];
    report.human_comparison = [
      [0, 1],
      [2, 0],
      [2, 1],
    ].map(([a, b]) => ({
      left: readers[a].coder_id,
      right: readers[b].coder_id,
      agreement: ['quality', 'accuracy'].map((field) =>
        readerAgreement(readers[a].ratings, readers[b].ratings, ids, field),
      ),
    }));
  }
  const number = (v) => (v === null ? 'unavailable' : v.toFixed(2));
  report.markdown =
    '# Automated teaching-quality assessment\n\n' +
    `Independent model: ${document.model.model}. ${report.accepted_ratings}/${report.planned_ratings} ratings retained. ` +
    'Keep this report and all model scores private from human readers until their ratings are complete.\n\n' +
    '| Contrast against generic revision | Model mean difference | Determinate pairs | Full-unit bounds |\n| --- | --- | --- | --- |\n' +
    report.contrasts
      .map(
        (r) =>
          `| ${r.arm} | ${number(r.complete_case_mean_descriptive)} | ${r.determinate_pairs}/${plan.units.length} | [${r.all_unit_identification_bounds.map(number).join(', ')}] |`,
      )
      .join('\n') +
    '\n\nThe one-point target is for planning, not a significance cutoff. Bounds are not confidence intervals. ' +
    'These are one model’s descriptive judgments of the same 12 draft units in six contexts, not human validation or evidence of learning. ' +
    'Accuracy is separate. Directive fulfillment, strategy change and transfer remain unmeasured.\n\n' +
    (humans
      ? 'Matched human/model agreement, every disagreement and individual ratings are in report.json.\n'
      : 'Human agreement remains pending two independent reader files.\n');
  return report;
}
