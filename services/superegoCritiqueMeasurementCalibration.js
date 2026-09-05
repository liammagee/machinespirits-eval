import { critiqueEnvelope } from './superegoCritiqueCausalFollowupAnalyzer.js';
import {
  loadFrozenReplayCorpus,
  publicDraft,
  validPublic,
  randomStream,
  buildReplayRequest,
  consensus,
  worstCost,
} from './superegoCritiqueCausalReplay.js';

function shuffle(values, random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Enrich the original identities; never select replacements or edit the sealed packet.
export function buildCalibrationPlan(design, packet, traceMap) {
  const rows = [...packet.identityLedger.rows].sort((a, b) => (a.item_id < b.item_id ? -1 : 1));
  if (rows.length !== design.sample_size || new Set(rows.map((r) => r.item_id)).size !== rows.length)
    throw new Error('Calibration must retain every original packet identity exactly once');
  const units = rows.map((row) => {
    const trace = traceMap.get(row.dialogue_id)?.dialogueTrace;
    if (!trace) throw new Error('Missing calibration source trace');
    const context = trace
      .slice(0, row.trace_indexes.draft)
      .filter((e) => ['tutor', 'user'].includes(e.agent) && e.action === 'context_input' && e.rawContext?.trim())
      .map((e) => e.rawContext)
      .join('\n\n');
    if (!context) throw new Error('Missing recorded calibration context; no substitution permitted');
    const critiqueEntry = trace[row.trace_indexes.critique];
    const unit = {
      unit_key: row.item_id,
      context,
      draft: publicDraft(trace[row.trace_indexes.draft]),
      critique: { ...critiqueEnvelope(critiqueEntry), confidence: critiqueEntry.confidence ?? null },
      revision: publicDraft(trace[row.trace_indexes.revision]),
      // Private mapping only; buildReplayRequest never forwards these fields.
      source: row,
    };
    if (!validPublic(unit.draft) || !validPublic(unit.revision))
      throw new Error('Missing or invalid complete public suggestions');
    const historicalModels = [row.ego_model, row.superego_model].map((model) => {
      const resolved = design.historical_model_routes?.[model];
      if (!resolved) throw new Error(`Unresolved historical calibration model: ${model}`);
      return resolved;
    });
    if (
      Object.entries(design.models).some(
        ([seat, route]) => seat !== 'generator' && historicalModels.includes(route.model),
      )
    )
      throw new Error('Calibration judge overlaps a historical source model');
    return unit;
  });
  const random = randomStream(design.master_seed);
  const jobs = ['semantic', 'quality'].flatMap((category) =>
    shuffle(
      units.flatMap((unit) =>
        ['a', 'b'].map((seat) => ({
          unit: unit.unit_key,
          arm: 'historical_revision',
          category,
          seat: `${category}_${seat}`,
          id: `${unit.unit_key}/historical_revision/${category}_${seat}`,
        })),
      ),
      random,
    ).map((job, index) => ({ ...job, presentation_id: `${category[0]}${String(index + 1).padStart(3, '0')}` })),
  );
  return { study_id: design.id, mode: 'calibration', seed: design.master_seed, units, jobs };
}

export async function prepareCalibrationPlan(root, options = {}) {
  const { design, followup, traceMap, packet } = await loadFrozenReplayCorpus(root, {
    ...options,
    mode: 'calibration',
  });
  const plan = buildCalibrationPlan(design, packet, traceMap);
  const requests = plan.jobs.map((job) => ({ job, request: buildReplayRequest(design, plan, job, new Map()) }));
  const costs = requests.map(({ job, request }) => worstCost(design, job.seat, request));
  const reservedMaximum = ['semantic', 'quality'].reduce(
    (sum, category) =>
      sum +
      design.attempts[`${category}_reserve`] *
        Math.max(
          ...requests
            .filter(({ job }) => job.category === category)
            .map(({ job, request }) => worstCost(design, job.seat, request)),
        ),
    costs.reduce((sum, cost) => sum + cost, 0),
  );
  if (reservedMaximum > design.max_dollars) throw new Error('Fixed calibration plan and reserve exceed dollar cap');
  plan.audit = {
    traces_verified: traceMap.size,
    original_packet_sha256: followup.semanticPacket.packetSha256,
    original_identity_ledger_sha256: followup.semanticPacket.identityLedgerSha256,
    original_packet_items: packet.packet.rows.length,
    original_items_without_context: packet.packet.rows.filter((row) => !row.context).length,
    original_items_with_omitted_suggestions: packet.packet.rows.filter(
      (row) => row.draft.suggestionCount > 1 || row.revision.suggestionCount > 1,
    ).length,
    later_round_items: plan.units.filter((unit) => unit.source.ordinal > 1).length,
    parser_failure_items: plan.units.filter((unit) => /unable to parse review/iu.test(unit.critique.feedback)).length,
    // Structural metadata are diagnostics, never semantic labels or eligibility rules.
    prepared_jobs: plan.jobs.length,
    maximum_message_bytes: Math.max(
      ...requests.map(({ request }) => Buffer.byteLength(JSON.stringify(request.messages))),
    ),
    jobs_over_original_replay_byte_cap: requests.filter(
      ({ request }) => Buffer.byteLength(JSON.stringify(request.messages)) > 16384,
    ).length,
    planned_reservation_dollars: costs.reduce((sum, cost) => sum + cost, 0),
    maximum_with_recovery_dollars: reservedMaximum,
    human_reference_labels: 0,
    model_labels: 0,
    readiness: 'not_validated',
  };
  return { design, plan };
}

export function calibrationCoderPackets(design, plan) {
  return Object.fromEntries(
    ['semantic_a', 'semantic_b', 'quality_a', 'quality_b'].map((seat) => {
      const jobs = plan.jobs.filter((job) => job.seat === seat);
      const requests = jobs.map((job) => buildReplayRequest(design, plan, job, new Map()));
      return [
        seat,
        {
          purpose:
            'Independent human coding, not completed reference labels. Keep each coder blind to the other sheets and all model ratings.',
          instructions: requests[0].messages[0].content,
          rows: requests.map((request) => ({
            data: JSON.parse(request.messages[1].content),
            coding: seat.startsWith('semantic')
              ? {
                  directive_fulfillment: null,
                  material_change: null,
                  critique_spans: [],
                  candidate_spans: [],
                  rationale: null,
                }
              : { quality: null, accuracy: null, evidence_spans: [], rationale: null },
          })),
        },
      ];
    }),
  );
}

export function summarizeCalibration(design, plan, responses) {
  const fields = ['directive_fulfillment', 'material_change', 'quality', 'accuracy'];
  const invalidJobs = [...responses.values()].filter((r) => r.response_status === 'invalid_response').length;
  return {
    study_id: design.id,
    processed_jobs: responses.size,
    completed_jobs: responses.size - invalidJobs,
    invalid_jobs: invalidJobs,
    missing_jobs: plan.jobs.length - responses.size,
    readiness: 'not_validated_against_independent_humans',
    fields: Object.fromEntries(
      fields.map((field) => {
        const lane = ['quality', 'accuracy'].includes(field) ? 'quality' : 'semantic';
        const rows = plan.units.map((unit) => {
          const responseA = responses.get(`${unit.unit_key}/historical_revision/${lane}_a`);
          const responseB = responses.get(`${unit.unit_key}/historical_revision/${lane}_b`);
          const a = responseA?.response_status === 'invalid_response' ? undefined : responseA?.[field];
          const b = responseB?.response_status === 'invalid_response' ? undefined : responseB?.[field];
          const invalid = [responseA, responseB].some((r) => r?.response_status === 'invalid_response');
          const missing = !responseA || !responseB;
          return {
            unit: unit.unit_key,
            a: a ?? null,
            b: b ?? null,
            invalid_response: invalid,
            missing_response: missing,
            consensus: missing ? 'missing_technical' : invalid ? 'invalid_response' : consensus(a, b),
          };
        });
        const paired = rows.filter((row) => row.a !== null && row.b !== null);
        const confusion = {};
        for (const row of paired) {
          const key = JSON.stringify([row.a, row.b]);
          confusion[key] = (confusion[key] || 0) + 1;
        }
        const numeric = paired.filter((row) => typeof row.a === 'number' && typeof row.b === 'number');
        return [
          field,
          {
            denominator: rows.length,
            complete_pairs: paired.length,
            missing_pairs: rows.filter((row) => row.missing_response).length,
            invalid_pairs: rows.filter((row) => row.invalid_response).length,
            unavailable_pairs: rows.length - paired.length,
            exact_agreements: paired.filter((row) => row.a === row.b).length,
            determinate_consensus: paired.filter(
              (row) => !['measurement_indeterminate', 'not_applicable'].includes(row.consensus),
            ).length,
            measurement_indeterminate: paired.filter((row) => row.consensus === 'measurement_indeterminate').length,
            both_not_applicable: paired.filter((row) => row.consensus === 'not_applicable').length,
            confusion,
            // Rater differences are diagnostics, not averaged consensus scores.
            mean_absolute_numeric_difference: numeric.length
              ? numeric.reduce((sum, row) => sum + Math.abs(row.a - row.b), 0) / numeric.length
              : null,
            rows,
          },
        ];
      }),
    ),
    individual_ratings: Object.fromEntries(responses),
    claim_boundary:
      'Fixed historical measurement calibration only. Agreement is not accuracy, causal evidence, quality improvement or learner benefit. Human reference coding is still required.',
  };
}
