import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const DEFAULT_MINI_DRAMA_ONTOLOGY = path.join(ROOT, 'config', 'rhetoric', 'mini-drama-ontology.v0.1.json');
export const DEFAULT_MINI_DRAMA_CARDS = path.join(ROOT, 'config', 'rhetoric', 'mini-drama-cards.v0.1.json');
export const DEFAULT_MINI_DRAMA_CODEBOOK = path.join(ROOT, 'config', 'rhetoric', 'mini-drama-codebook.v0.1.json');
export const DEFAULT_A18_A19_RHETORICAL_BATTERY = path.join(
  ROOT,
  'config',
  'rhetoric',
  'a18-a19-rhetorical-battery.v0.1.json',
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolvePath(filePath) {
  return path.resolve(filePath || '.');
}

export function repoRel(filePath) {
  return path.relative(ROOT, path.resolve(filePath));
}

export function sha256(text) {
  return crypto
    .createHash('sha256')
    .update(String(text || ''))
    .digest('hex');
}

export function wordCount(text) {
  return String(text || '')
    .trim()
    .split(/\s+/u)
    .filter(Boolean).length;
}

export function loadMiniDramaOntology(filePath = DEFAULT_MINI_DRAMA_ONTOLOGY) {
  const resolved = resolvePath(filePath);
  const ontology = readJson(resolved);
  return { ...ontology, source_path: repoRel(resolved) };
}

export function loadMiniDramaCards(filePath = DEFAULT_MINI_DRAMA_CARDS) {
  const resolved = resolvePath(filePath);
  const pool = readJson(resolved);
  return { ...pool, source_path: repoRel(resolved) };
}

export function loadMiniDramaCodebook(filePath = DEFAULT_MINI_DRAMA_CODEBOOK) {
  const resolved = resolvePath(filePath);
  const codebook = readJson(resolved);
  return { ...codebook, source_path: repoRel(resolved) };
}

function moveMap(ontology) {
  return new Map((ontology.moves || []).map((move) => [move.id, move]));
}

function requireMove(ontology, moveId) {
  const move = moveMap(ontology).get(moveId);
  if (!move) throw new Error(`unknown mini-drama move: ${moveId}`);
  return move;
}

function selectedMoveIds(ontology, moveIds = []) {
  const ids = moveIds.length ? moveIds : ontology.first_wave_move_ids || [];
  ids.forEach((id) => requireMove(ontology, id));
  return ids;
}

function selectedCards(cardPool, cardIds = []) {
  const cards = cardPool.cards || [];
  if (!cardIds.length) return cards;
  const wanted = new Set(cardIds);
  const out = cards.filter((card) => wanted.has(card.card_id));
  const missing = cardIds.filter((id) => !out.some((card) => card.card_id === id));
  if (missing.length) throw new Error(`unknown mini-drama card(s): ${missing.join(', ')}`);
  return out;
}

function seededUnit(seed) {
  const hash = sha256(seed).slice(0, 12);
  return Number.parseInt(hash, 16) / 0xffffffffffff;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function normalizeScore(score) {
  return clamp01((score - 0.2) / 0.8);
}

function sentence(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return '';
  return /[.!?]$/u.test(trimmed) ? trimmed : `${trimmed}.`;
}

export function formatMiniDramaTranscript(card, tutorResponse) {
  return [`STAGE: ${card.stage}`, `LEARNER: ${card.learner}`, `TUTOR: ${tutorResponse}`].join('\n');
}

export function generateShadowControl(card) {
  return sentence(
    `Let's make this smaller. Focus on one local step: ${card.micro_task}. Say what you notice before doing anything else`,
  );
}

export function generateMiniDramaResponse(card, moveId, ontology = loadMiniDramaOntology()) {
  requireMove(ontology, moveId);
  const templates = {
    stasis_hypophora_reset: () =>
      `Question: ${card.stasis_question}? Answer: ${card.brief_answer}. Now ${card.micro_task}.`,
    synkrisis_exemplum: () =>
      `This is like ${card.near_analog}. Example: first match the role, then compare the count. Try it here: ${card.micro_task}.`,
    enargeia_subgoal: () =>
      `Picture three small boxes. First: name the job. Second: touch the clue. Third: ${card.micro_task}. Keep only those boxes in view.`,
    peripeteia_error_spotting: () =>
      `Switch the job: do not solve the whole thing yet. Spot the wrong turn: ${card.wrong_turn}. Then ${card.micro_task}.`,
    anagnorisis_sententia: () =>
      `What just became visible: ${card.hidden_relation}. Keep this principle: mark the role before judging the result. Now ${card.micro_task}.`,
    ethopoeia_correctio: () =>
      `"${card.voiced_position}." More exactly: ${card.correction}. Try only this: ${card.micro_task}.`,
  };
  return sentence(templates[moveId]());
}

function forbiddenTermHits(text, terms) {
  const lower = String(text || '').toLowerCase();
  return terms.filter((term) => new RegExp(`\\b${term}\\b`, 'u').test(lower));
}

function hasMoveSignature(text, moveId) {
  const value = String(text || '');
  const checks = {
    stasis_hypophora_reset: () => /Question:[^?]+\?\s+Answer:/su.test(value),
    synkrisis_exemplum: () => /\b(like|compare|same shape)\b/iu.test(value) && /\bExample:/u.test(value),
    enargeia_subgoal: () => /\bPicture\b/iu.test(value) && /\bFirst:/u.test(value) && /\bSecond:/u.test(value),
    peripeteia_error_spotting: () => /\bSwitch the job\b/iu.test(value) && /\bSpot the wrong turn\b/iu.test(value),
    anagnorisis_sententia: () => /\bWhat just became visible\b/iu.test(value) && /\bprinciple\b/iu.test(value),
    ethopoeia_correctio: () => /^".+"\s+More exactly:/su.test(value),
  };
  return checks[moveId]?.() || false;
}

export function runMiniDramaGates({ response, moveId, ontology = loadMiniDramaOntology(), maxWords = null }) {
  const resolvedMaxWords = maxWords || ontology.max_words || 70;
  const count = wordCount(response);
  const forbiddenHits = forbiddenTermHits(response, ontology.forbidden_surface_terms || []);
  const gates = [
    {
      id: 'length_control',
      status: count <= resolvedMaxWords ? 'pass' : 'fail',
      value: count,
      limit: resolvedMaxWords,
    },
    {
      id: 'forbidden_surface_terms_absent',
      status: forbiddenHits.length ? 'fail' : 'pass',
      hits: forbiddenHits,
    },
    {
      id: 'move_fidelity_signature_present',
      status: moveId === 'shadow_control' || hasMoveSignature(response, moveId) ? 'pass' : 'fail',
      move_id: moveId,
    },
    {
      id: 'no_private_disclosure_request',
      status: /\b(tell me|share).*\b(private|personal|secret)\b/iu.test(response) ? 'fail' : 'pass',
    },
    {
      id: 'no_direct_answer_leakage',
      status: /\b(the answer is|correct answer|solution is)\b/iu.test(response) ? 'fail' : 'pass',
    },
  ];
  return {
    status: gates.every((gate) => gate.status === 'pass') ? 'pass' : 'fail',
    gates,
  };
}

const IMPASSE_MOVE_WEIGHTS = {
  counter_warrant: {
    stasis_hypophora_reset: 0.92,
    synkrisis_exemplum: 0.78,
    anagnorisis_sententia: 0.72,
    peripeteia_error_spotting: 0.62,
  },
  surface_agreement: {
    peripeteia_error_spotting: 0.9,
    enargeia_subgoal: 0.76,
    stasis_hypophora_reset: 0.72,
    anagnorisis_sententia: 0.62,
  },
  productive_impasse: {
    enargeia_subgoal: 0.92,
    stasis_hypophora_reset: 0.82,
    ethopoeia_correctio: 0.64,
    peripeteia_error_spotting: 0.6,
  },
  over_compliance: {
    ethopoeia_correctio: 0.9,
    peripeteia_error_spotting: 0.82,
    enargeia_subgoal: 0.74,
    anagnorisis_sententia: 0.62,
  },
  public_commitment_conflict: {
    anagnorisis_sententia: 0.9,
    stasis_hypophora_reset: 0.82,
    ethopoeia_correctio: 0.72,
    synkrisis_exemplum: 0.62,
  },
  status_threat: {
    ethopoeia_correctio: 0.9,
    anagnorisis_sententia: 0.82,
    stasis_hypophora_reset: 0.72,
    synkrisis_exemplum: 0.58,
  },
  working_agreement_drift: {
    stasis_hypophora_reset: 0.88,
    anagnorisis_sententia: 0.8,
    ethopoeia_correctio: 0.74,
    peripeteia_error_spotting: 0.62,
  },
  competing_visible_cues: {
    peripeteia_error_spotting: 0.9,
    enargeia_subgoal: 0.84,
    synkrisis_exemplum: 0.76,
    stasis_hypophora_reset: 0.7,
  },
  diffuse_confusion: {
    stasis_hypophora_reset: 0.9,
    enargeia_subgoal: 0.78,
    synkrisis_exemplum: 0.62,
  },
  abstraction_failure: {
    synkrisis_exemplum: 0.88,
    anagnorisis_sententia: 0.72,
    enargeia_subgoal: 0.68,
  },
  novice_overload: {
    enargeia_subgoal: 0.9,
    stasis_hypophora_reset: 0.72,
    ethopoeia_correctio: 0.56,
  },
  search_paralysis: {
    peripeteia_error_spotting: 0.9,
    enargeia_subgoal: 0.7,
    stasis_hypophora_reset: 0.62,
  },
  partial_knowledge: {
    anagnorisis_sententia: 0.9,
    stasis_hypophora_reset: 0.66,
    synkrisis_exemplum: 0.62,
  },
};

function scoreMoveFit(card, moveId) {
  const byImpasse = IMPASSE_MOVE_WEIGHTS[card.impasse_type] || {};
  let score = byImpasse[moveId] || 0.42;
  if (
    card.frame_bound &&
    ['anagnorisis_sententia', 'synkrisis_exemplum', 'peripeteia_error_spotting'].includes(moveId)
  ) {
    score += 0.08;
  }
  if (card.risk_budget === 'medium' && moveId === 'ethopoeia_correctio') score += 0.06;
  if (card.task_stage === 'after_failure' && moveId === 'peripeteia_error_spotting') score += 0.05;
  if (card.expected_baseline_failure === 'answer_leakage' && moveId === 'enargeia_subgoal') score += 0.08;
  if (card.expected_baseline_failure === 'over_scaffolding' && moveId === 'ethopoeia_correctio') score += 0.06;
  if (card.expected_baseline_failure === 'wrong_strategy_family' && moveId === 'peripeteia_error_spotting')
    score += 0.06;
  return clamp01(score);
}

export function selectMiniDramaMovesForCard({
  card,
  ontology = loadMiniDramaOntology(),
  moveIds = [],
  samplesPerCard = 2,
  seed = 'a19r-mini-drama',
  exploration = 0.18,
} = {}) {
  const moves = selectedMoveIds(ontology, moveIds);
  const scored = moves.map((moveId) => {
    const fit = scoreMoveFit(card, moveId);
    const jitter = seededUnit(`${seed}:${card.card_id}:${moveId}`) * exploration;
    return {
      move_id: moveId,
      fit_score: fit,
      stochastic_jitter: Number(jitter.toFixed(4)),
      selection_score: Number((fit + jitter).toFixed(4)),
      reason: `impasse=${card.impasse_type}; stage=${card.task_stage}; expected_failure=${card.expected_baseline_failure || 'unknown'}`,
    };
  });
  return scored.sort((a, b) => b.selection_score - a.selection_score).slice(0, samplesPerCard);
}

function containsActionGate(text) {
  return /\b(try|choose|name|point|touch|draw|compare|spot|mark|quote|say|test|circle|underline)\b/iu.test(text);
}

function genericWarmthOnlyRisk(text) {
  return /\b(good job|you are doing great|you meant well|do not be too hard|you've got this)\b/iu.test(text);
}

function scoreCandidateProxy({ response, moveId, gates, selection = null, ontology = loadMiniDramaOntology() }) {
  const gatePass = gates.status === 'pass' ? 1 : 0;
  const fidelity = moveId === 'shadow_control' ? 0 : hasMoveSignature(response, moveId) ? 1 : 0;
  const actionGate = containsActionGate(response) ? 1 : 0;
  const antiCollapse = genericWarmthOnlyRisk(response) ? 0 : 1;
  const leakageAvoided = /\b(the answer is|correct answer|solution is)\b/iu.test(response) ? 0 : 1;
  const brevity = clamp01(1 - Math.max(0, wordCount(response) - (ontology.max_words || 70) + 12) / 24);
  const fit = selection ? normalizeScore(selection.fit_score) : moveId === 'shadow_control' ? 0.42 : 0.5;
  const score =
    0.28 * gatePass +
    0.22 * fidelity +
    0.2 * fit +
    0.12 * actionGate +
    0.1 * antiCollapse +
    0.05 * leakageAvoided +
    0.03 * brevity;
  return {
    score: Number(score.toFixed(4)),
    components: {
      gate_pass: gatePass,
      move_fidelity: fidelity,
      heuristic_fit: Number(fit.toFixed(4)),
      action_gate: actionGate,
      anti_collapse: antiCollapse,
      leakage_avoided: leakageAvoided,
      brevity: Number(brevity.toFixed(4)),
    },
  };
}

export function runMiniDramaBatteryScreen({
  ontology = loadMiniDramaOntology(),
  cardPool = loadMiniDramaCards(DEFAULT_A18_A19_RHETORICAL_BATTERY),
  moveIds = [],
  cardIds = [],
  samplesPerCard = 2,
  seed = 'a19r-mini-drama-battery-v0.1',
  runId = null,
  createdAt = new Date().toISOString(),
} = {}) {
  const cards = selectedCards(cardPool, cardIds);
  const resolvedRunId = runId || `a19r-mini-drama-battery-${createdAt.slice(0, 10)}`;
  const candidates = [];
  for (const card of cards) {
    const selectedMoves = selectMiniDramaMovesForCard({ card, ontology, moveIds, samplesPerCard, seed });
    const shadowResponse = generateShadowControl(card);
    const shadowGates = runMiniDramaGates({ response: shadowResponse, moveId: 'shadow_control', ontology });
    const shadowProxy = scoreCandidateProxy({
      response: shadowResponse,
      moveId: 'shadow_control',
      gates: shadowGates,
      ontology,
    });
    for (const selection of selectedMoves) {
      const response = generateMiniDramaResponse(card, selection.move_id, ontology);
      const gates = runMiniDramaGates({ response, moveId: selection.move_id, ontology });
      const proxy = scoreCandidateProxy({ response, moveId: selection.move_id, gates, selection, ontology });
      const delta = Number((proxy.score - shadowProxy.score).toFixed(4));
      candidates.push({
        candidate_id: `${card.card_id}__${selection.move_id}`,
        card_id: card.card_id,
        source_protocol: card.source_protocol || null,
        source_family: card.source_family || null,
        source_sibling: card.source_sibling || null,
        move_id: selection.move_id,
        selection,
        impasse_type: card.impasse_type,
        task_stage: card.task_stage,
        risk_budget: card.risk_budget,
        frame_bound: card.frame_bound,
        expected_baseline_failure: card.expected_baseline_failure || null,
        screen_status: delta >= 0.08 && gates.status === 'pass' ? 'rhetorical_proxy_headroom' : 'no_proxy_headroom',
        proxy_score: proxy.score,
        shadow_proxy_score: shadowProxy.score,
        proxy_delta: delta,
        proxy_components: proxy.components,
        shadow_control: {
          response: shadowResponse,
          response_sha256: sha256(shadowResponse),
          transcript: formatMiniDramaTranscript(card, shadowResponse),
          gates: shadowGates,
          proxy_score: shadowProxy.score,
          proxy_components: shadowProxy.components,
        },
        mini_drama: {
          response,
          response_sha256: sha256(response),
          transcript: formatMiniDramaTranscript(card, response),
          gates,
          proxy_score: proxy.score,
          proxy_components: proxy.components,
        },
      });
    }
  }
  return {
    schema_version: 'mini-drama-battery-screen-v0.1',
    branch: ontology.branch || 'a19r-mini-drama',
    run_id: resolvedRunId,
    created_at: createdAt,
    seed,
    samples_per_card: samplesPerCard,
    ontology_id: ontology.ontology_id,
    ontology_path: ontology.source_path || null,
    card_pool_id: cardPool.card_pool_id,
    card_pool_path: cardPool.source_path || null,
    max_words: ontology.max_words || 70,
    move_ids: moveIds.length ? moveIds : ontology.first_wave_move_ids || [],
    card_ids: cards.map((card) => card.card_id),
    candidates,
    non_claims: ontology.non_claims || [],
  };
}

export function generateMiniDramaRun({
  ontology = loadMiniDramaOntology(),
  cardPool = loadMiniDramaCards(),
  moveIds = [],
  cardIds = [],
  runId = null,
  createdAt = new Date().toISOString(),
} = {}) {
  const moves = selectedMoveIds(ontology, moveIds);
  const cards = selectedCards(cardPool, cardIds);
  const resolvedRunId = runId || `a19r-mini-drama-${createdAt.slice(0, 10)}`;
  const candidates = [];
  for (const card of cards) {
    const shadowResponse = generateShadowControl(card);
    const shadowGates = runMiniDramaGates({ response: shadowResponse, moveId: 'shadow_control', ontology });
    for (const moveId of moves) {
      const response = generateMiniDramaResponse(card, moveId, ontology);
      const gates = runMiniDramaGates({ response, moveId, ontology });
      const candidateId = `${card.card_id}__${moveId}`;
      candidates.push({
        candidate_id: candidateId,
        card_id: card.card_id,
        move_id: moveId,
        impasse_type: card.impasse_type,
        task_stage: card.task_stage,
        risk_budget: card.risk_budget,
        frame_bound: card.frame_bound,
        shadow_control: {
          response: shadowResponse,
          response_sha256: sha256(shadowResponse),
          transcript: formatMiniDramaTranscript(card, shadowResponse),
          gates: shadowGates,
        },
        mini_drama: {
          response,
          response_sha256: sha256(response),
          transcript: formatMiniDramaTranscript(card, response),
          gates,
        },
      });
    }
  }
  return {
    schema_version: 'mini-drama-run-v0.1',
    branch: ontology.branch || 'a19r-mini-drama',
    run_id: resolvedRunId,
    created_at: createdAt,
    ontology_id: ontology.ontology_id,
    ontology_path: ontology.source_path || null,
    card_pool_id: cardPool.card_pool_id,
    card_pool_path: cardPool.source_path || null,
    max_words: ontology.max_words || 70,
    move_ids: moves,
    card_ids: cards.map((card) => card.card_id),
    candidates,
    non_claims: ontology.non_claims || [],
  };
}

function stableArmSources(candidate, seed) {
  const sources = [
    {
      source: 'shadow_control',
      transcript: candidate.shadow_control.transcript,
      transcript_sha256: sha256(candidate.shadow_control.transcript),
      response_sha256: candidate.shadow_control.response_sha256,
      gates: candidate.shadow_control.gates,
    },
    {
      source: 'mini_drama',
      transcript: candidate.mini_drama.transcript,
      transcript_sha256: sha256(candidate.mini_drama.transcript),
      response_sha256: candidate.mini_drama.response_sha256,
      gates: candidate.mini_drama.gates,
    },
  ];
  return sources.sort((a, b) =>
    sha256(`${seed}:${candidate.candidate_id}:${a.source}`).localeCompare(
      sha256(`${seed}:${candidate.candidate_id}:${b.source}`),
    ),
  );
}

export function buildMiniDramaPacket({
  run,
  candidate,
  ontology = loadMiniDramaOntology(),
  codebookVersion = '0.1.0',
}) {
  const ordered = stableArmSources(candidate, run.run_id);
  const blindSuffix = sha256(candidate.candidate_id).slice(0, 12);
  const packetId = `mini_drama_v01__${candidate.card_id}__${blindSuffix}`;
  const arms = ordered.map((source, index) => ({
    arm_label: index === 0 ? 'arm_A' : 'arm_B',
    transcript: source.transcript,
    transcript_sha256: source.transcript_sha256,
  }));
  const coderPacket = {
    packet_schema_version: 'mini-drama-coder-packet-v0.1',
    instructions: [
      'Read both arms as local tutor responses to the same learner impasse.',
      'Do not infer which arm is the mini-drama candidate.',
      'Score move fidelity and impasse usefulness, not elegance alone.',
    ],
    neutral_option_space: 'response A | response B',
    arms,
  };
  const coderPacketText = JSON.stringify(coderPacket);
  const armPrivate = Object.fromEntries(
    arms.map((arm, index) => [
      arm.arm_label,
      {
        provenance: ordered[index].source,
        move_id: ordered[index].source === 'mini_drama' ? candidate.move_id : 'shadow_control',
        response_sha256: ordered[index].response_sha256,
        gate_status: ordered[index].gates.status,
        gates: ordered[index].gates.gates,
      },
    ]),
  );
  return {
    schema_version: 'mini-drama-adjudication-packet-v0.1',
    branch: run.branch,
    run_id: run.run_id,
    created_at: run.created_at,
    family_id: 'mini_drama_v01',
    sibling_id: `${candidate.card_id}_${blindSuffix}`,
    packet_id: packetId,
    codebook_version: codebookVersion,
    ontology_id: run.ontology_id,
    card_pool_id: run.card_pool_id,
    claim_boundary: 'simulated_teacher_as_learner_not_human_learning',
    status: 'packet_only_no_judgments',
    coder_packet: coderPacket,
    private_key: {
      ...armPrivate,
      intended_move_id: candidate.move_id,
      target_aliases: [],
      decoy_aliases: [],
      target_repair_type: candidate.move_id,
      decoy_repair_types: ['shadow_control'],
      withheld_from_coder: ['arm_provenance', 'intended_move_id', 'gate_results'],
    },
    audit: {
      coder_packet_sha256: sha256(coderPacketText),
      move_labels_visible_to_coder: false,
      arm_provenance_visible_to_coder: false,
      gate_summary: {
        mini_drama: candidate.mini_drama.gates.status,
        shadow_control: candidate.shadow_control.gates.status,
      },
      visible_alias_hits_in_public_transcripts: [],
      forbidden_surface_term_hits: [
        ...forbiddenTermHits(candidate.mini_drama.response, ontology.forbidden_surface_terms || []),
        ...forbiddenTermHits(candidate.shadow_control.response, ontology.forbidden_surface_terms || []),
      ],
    },
    non_claims: run.non_claims || ontology.non_claims || [],
  };
}

export function buildMiniDramaPackets({ run, ontology = loadMiniDramaOntology(), candidateIds = [] }) {
  const wanted = new Set(candidateIds);
  const candidates = candidateIds.length
    ? run.candidates.filter((candidate) => wanted.has(candidate.candidate_id))
    : run.candidates;
  const missing = candidateIds.filter((id) => !candidates.some((candidate) => candidate.candidate_id === id));
  if (missing.length) throw new Error(`unknown candidate id(s): ${missing.join(', ')}`);
  return candidates.map((candidate) => buildMiniDramaPacket({ run, candidate, ontology }));
}

export function validateMiniDramaCodebook({
  codebook = loadMiniDramaCodebook(),
  ontology = loadMiniDramaOntology(),
} = {}) {
  const issues = [];
  const labels = new Set(
    codebook.allowed_primary_labels || [codebook.target_label, ...(codebook.near_miss_labels || [])],
  );
  for (const moveId of ontology.first_wave_move_ids || []) {
    if (!labels.has(moveId)) {
      issues.push({ severity: 'error', code: 'missing_move_label', move_id: moveId });
    }
  }
  for (const required of ['shadow_control', 'generic_warmth_only', 'answer_leakage', 'unclear']) {
    if (!labels.has(required)) issues.push({ severity: 'error', code: 'missing_control_label', label: required });
  }
  for (const required of ['move_fidelity_visible', 'helps_impasse_not_polish', 'answer_leakage_avoided']) {
    if (!(codebook.required_obligations || []).some((entry) => entry.id === required)) {
      issues.push({ severity: 'error', code: 'missing_required_obligation', obligation: required });
    }
  }
  for (const arm of ['arm_alpha', 'arm_beta', 'neither', 'unclear']) {
    if (!(codebook.pairwise_better_arm_values || []).includes(arm)) {
      issues.push({ severity: 'error', code: 'missing_pairwise_value', value: arm });
    }
  }
  return {
    schema_version: 'mini-drama-codebook-validation-v0.1',
    status: issues.some((issue) => issue.severity === 'error') ? 'fail' : 'pass',
    codebook_id: codebook.codebook_id,
    ontology_id: ontology.ontology_id,
    issues,
  };
}

export function qaMiniDramaRun(run) {
  const candidateIssues = [];
  for (const candidate of run.candidates || []) {
    for (const [arm, payload] of [
      ['mini_drama', candidate.mini_drama],
      ['shadow_control', candidate.shadow_control],
    ]) {
      for (const gate of payload.gates.gates || []) {
        if (gate.status !== 'pass') {
          candidateIssues.push({
            severity: 'error',
            code: 'gate_failed',
            candidate_id: candidate.candidate_id,
            arm,
            gate_id: gate.id,
          });
        }
      }
    }
  }
  return {
    schema_version: 'mini-drama-qa-v0.1',
    status: candidateIssues.length ? 'fail' : 'pass',
    run_id: run.run_id,
    candidate_count: run.candidates?.length || 0,
    issue_count: candidateIssues.length,
    issues: candidateIssues,
  };
}

export function summarizeMiniDramaRun(run) {
  const qa = qaMiniDramaRun(run);
  const byMove = {};
  for (const candidate of run.candidates || []) {
    byMove[candidate.move_id] = (byMove[candidate.move_id] || 0) + 1;
  }
  return {
    schema_version: 'mini-drama-report-v0.1',
    run_id: run.run_id,
    branch: run.branch,
    ontology_id: run.ontology_id,
    card_pool_id: run.card_pool_id,
    card_count: run.card_ids?.length || 0,
    candidate_count: run.candidates?.length || 0,
    gate_status: qa.status,
    candidates_by_move: byMove,
    non_claims: run.non_claims || [],
  };
}

export function summarizeMiniDramaBatteryScreen(screen) {
  const qa = qaMiniDramaRun(screen);
  const candidates = screen.candidates || [];
  const wins = candidates.filter((candidate) => candidate.screen_status === 'rhetorical_proxy_headroom');
  const byMove = {};
  const byProtocol = {};
  const byFamily = {};
  for (const candidate of candidates) {
    const moveEntry = byMove[candidate.move_id] || { tested: 0, proxy_headroom: 0, mean_delta: 0 };
    moveEntry.tested += 1;
    moveEntry.proxy_headroom += candidate.screen_status === 'rhetorical_proxy_headroom' ? 1 : 0;
    moveEntry.mean_delta += candidate.proxy_delta || 0;
    byMove[candidate.move_id] = moveEntry;

    const protocol = candidate.source_protocol || 'unknown';
    const protocolEntry = byProtocol[protocol] || { tested: 0, proxy_headroom: 0 };
    protocolEntry.tested += 1;
    protocolEntry.proxy_headroom += candidate.screen_status === 'rhetorical_proxy_headroom' ? 1 : 0;
    byProtocol[protocol] = protocolEntry;

    const family = candidate.source_family || 'unknown';
    const familyEntry = byFamily[family] || { tested: 0, proxy_headroom: 0, best_delta: -Infinity };
    familyEntry.tested += 1;
    familyEntry.proxy_headroom += candidate.screen_status === 'rhetorical_proxy_headroom' ? 1 : 0;
    familyEntry.best_delta = Math.max(familyEntry.best_delta, candidate.proxy_delta || 0);
    byFamily[family] = familyEntry;
  }
  for (const entry of Object.values(byMove)) {
    entry.mean_delta = Number((entry.mean_delta / Math.max(1, entry.tested)).toFixed(4));
    entry.proxy_headroom_rate = Number((entry.proxy_headroom / Math.max(1, entry.tested)).toFixed(4));
  }
  for (const entry of Object.values(byProtocol)) {
    entry.proxy_headroom_rate = Number((entry.proxy_headroom / Math.max(1, entry.tested)).toFixed(4));
  }
  for (const entry of Object.values(byFamily)) {
    entry.proxy_headroom_rate = Number((entry.proxy_headroom / Math.max(1, entry.tested)).toFixed(4));
    entry.best_delta = Number(entry.best_delta.toFixed(4));
  }
  const sorted = [...candidates].sort((a, b) => (b.proxy_delta || 0) - (a.proxy_delta || 0));
  const proxyHeadroomRate = Number((wins.length / Math.max(1, candidates.length)).toFixed(4));
  let feasibility = 'weak_proxy_signal';
  if (qa.status !== 'pass') feasibility = 'blocked_by_gate_failures';
  else if (proxyHeadroomRate >= 0.6) feasibility = 'feasible_for_blinded_packet_screen';
  else if (proxyHeadroomRate >= 0.35) feasibility = 'borderline_needs_human_packet_screen';
  return {
    schema_version: 'mini-drama-battery-report-v0.1',
    run_id: screen.run_id,
    branch: screen.branch,
    seed: screen.seed,
    ontology_id: screen.ontology_id,
    card_pool_id: screen.card_pool_id,
    card_count: screen.card_ids?.length || 0,
    candidate_count: candidates.length,
    gate_status: qa.status,
    gate_issue_count: qa.issue_count,
    proxy_headroom_count: wins.length,
    proxy_headroom_rate: proxyHeadroomRate,
    feasibility,
    candidates_by_move: byMove,
    candidates_by_protocol: byProtocol,
    candidates_by_family: byFamily,
    strongest_candidates: sorted.slice(0, 5).map((candidate) => ({
      candidate_id: candidate.candidate_id,
      source_protocol: candidate.source_protocol,
      source_family: candidate.source_family,
      move_id: candidate.move_id,
      proxy_delta: candidate.proxy_delta,
      proxy_score: candidate.proxy_score,
      shadow_proxy_score: candidate.shadow_proxy_score,
    })),
    weakest_candidates: sorted
      .slice(-5)
      .reverse()
      .map((candidate) => ({
        candidate_id: candidate.candidate_id,
        source_protocol: candidate.source_protocol,
        source_family: candidate.source_family,
        move_id: candidate.move_id,
        proxy_delta: candidate.proxy_delta,
        proxy_score: candidate.proxy_score,
        shadow_proxy_score: candidate.shadow_proxy_score,
      })),
    interpretation_limits: [
      'proxy scores are deterministic screens, not S0/S1 evidence',
      'shadow controls are local plain-language controls, not recursive-full baselines',
      'automated/model adjudication is required before treating any candidate as real headroom',
    ],
    non_claims: screen.non_claims || [],
  };
}

export function tutorResponseFromTranscript(transcript) {
  const match = /(?:^|\n)TUTOR:\s*([\s\S]*)$/u.exec(String(transcript || ''));
  return match ? match[1].trim() : String(transcript || '').trim();
}

function detectedMoveLabels(response, ontology = loadMiniDramaOntology()) {
  return (ontology.first_wave_move_ids || []).filter((moveId) => hasMoveSignature(response, moveId));
}

export function classifyMiniDramaArm({
  arm,
  codebook = loadMiniDramaCodebook(),
  ontology = loadMiniDramaOntology(),
} = {}) {
  const transcript = arm?.transcript || '';
  const response = tutorResponseFromTranscript(transcript);
  const moveLabels = detectedMoveLabels(response, ontology);
  const answerLeakage = /\b(the answer is|correct answer|solution is)\b/iu.test(response);
  const privatePressure = /\b(tell me|share).*\b(private|personal|secret)\b/iu.test(response);
  const warmthOnly = genericWarmthOnlyRisk(response);
  const actionGate = containsActionGate(response);
  const shadowLike = /\blet's make this smaller\b.*\bfocus on one local step\b/isu.test(response);
  let primaryLabel = 'other';
  let targetStatus = 'unclear';
  let confidence = 0.5;
  let score = 0.35;

  if (answerLeakage) {
    primaryLabel = 'answer_leakage';
    targetStatus = 'non_target';
    confidence = 0.9;
    score = 0.05;
  } else if (moveLabels.length) {
    primaryLabel = moveLabels[0];
    targetStatus = 'target';
    confidence = moveLabels.length === 1 ? 0.9 : 0.72;
    score = moveLabels.length === 1 ? 1 : 0.82;
  } else if (shadowLike) {
    primaryLabel = 'shadow_control';
    targetStatus = 'near_target';
    confidence = 0.82;
    score = 0.58;
  } else if (warmthOnly) {
    primaryLabel = 'generic_warmth_only';
    targetStatus = 'non_target';
    confidence = 0.78;
    score = 0.2;
  } else {
    targetStatus = actionGate ? 'near_target' : 'unclear';
    confidence = actionGate ? 0.62 : 0.46;
    score = actionGate ? 0.48 : 0.32;
  }

  const obligations = {
    move_fidelity_visible: targetStatus === 'target' ? 'present' : shadowLike ? 'absent' : 'partial',
    helps_impasse_not_polish: targetStatus === 'target' ? 'present' : actionGate ? 'partial' : 'unclear',
    learner_agency_preserved: actionGate && !answerLeakage ? 'present' : 'partial',
    answer_leakage_avoided: answerLeakage ? 'absent' : 'present',
    manipulation_pressure_avoided: privatePressure ? 'absent' : 'present',
  };
  const excluded = [];
  if (answerLeakage) excluded.push('answers_the_task_directly');
  if (privatePressure) excluded.push('asks_for_more_private_disclosure');
  if (warmthOnly) excluded.push('generic_warmth_without_impasse_work');
  if (!actionGate) excluded.push('ignores_impasse');
  const excludedMovesPresent = excluded.length ? excluded : ['none'];
  const allowedLabels = new Set(codebook.allowed_primary_labels || []);
  if (allowedLabels.size && !allowedLabels.has(primaryLabel)) primaryLabel = 'other';

  return {
    arm_label: arm?.arm_label || null,
    primary_label: primaryLabel,
    target_status: targetStatus,
    target_granularity_risk: moveLabels.length > 1,
    obligations,
    excluded_moves_present: excludedMovesPresent,
    evidence_spans: [
      {
        quote: response.slice(0, 160),
        supports: primaryLabel,
      },
    ],
    score: Number(score.toFixed(4)),
    rationale:
      targetStatus === 'target'
        ? `The arm visibly instantiates ${primaryLabel} and preserves a local learner action.`
        : shadowLike
          ? 'The arm is a plain local shadow control: useful, but it does not instantiate a registered mini-drama move.'
          : 'The arm does not cleanly instantiate a registered mini-drama move.',
    confidence,
  };
}

export function adjudicateMiniDramaCoderPacket({
  coderPacket,
  codebook = loadMiniDramaCodebook(),
  ontology = loadMiniDramaOntology(),
  criticId = 'deterministic-mini-drama-v0.1',
  adjudicatedAt = new Date().toISOString(),
} = {}) {
  const arms = coderPacket?.arms || [];
  const armJudgments = arms.map((arm) => classifyMiniDramaArm({ arm, codebook, ontology }));
  const sorted = [...armJudgments].sort((a, b) => b.score - a.score);
  const top = sorted[0] || null;
  const second = sorted[1] || null;
  const scoreDelta = top && second ? Number((top.score - second.score).toFixed(4)) : 0;
  const betterArmLabel = top && scoreDelta >= 0.1 ? top.arm_label : 'unclear';
  const betterForTargetReason =
    betterArmLabel !== 'unclear' && top.target_status === 'target' && !top.target_granularity_risk;
  return {
    schema_version: 'mini-drama-automated-raw-judgment-v0.1',
    critic_id: criticId,
    adjudicated_at: adjudicatedAt,
    codebook_id: codebook.codebook_id,
    private_key_used: false,
    arm_judgments: armJudgments,
    pairwise_judgment: {
      better_arm_label: betterArmLabel,
      better_for_target_reason: betterForTargetReason,
      score_delta: scoreDelta,
      alias_leakage_assessment: 'none_observed',
      rationale:
        betterArmLabel === 'unclear'
          ? 'No arm is clearly better under the deterministic mini-drama read.'
          : `${betterArmLabel} is stronger because it visibly instantiates a registered move for the local impasse.`,
    },
  };
}

export function applyMiniDramaPrivateKey({ packet, rawJudgment } = {}) {
  const privateKey = packet?.private_key || {};
  const mappedArms = (rawJudgment?.arm_judgments || []).map((judgment) => {
    const mapping = privateKey[judgment.arm_label] || {};
    return {
      arm_label: judgment.arm_label,
      primary_label: judgment.primary_label,
      target_status: judgment.target_status,
      score: judgment.score,
      provenance: mapping.provenance || 'unknown',
      hidden_move_id: mapping.move_id || null,
      gate_status: mapping.gate_status || null,
    };
  });
  const betterArmLabel = rawJudgment?.pairwise_judgment?.better_arm_label || 'unclear';
  const betterMapping = privateKey[betterArmLabel] || null;
  const preferredCondition =
    betterMapping?.provenance === 'mini_drama'
      ? 'S1_mini_drama'
      : betterMapping?.provenance === 'shadow_control'
        ? 'S0_shadow_control'
        : 'unclear';
  const intendedMoveId = privateKey.intended_move_id || null;
  const preferredJudgment = (rawJudgment?.arm_judgments || []).find(
    (judgment) => judgment.arm_label === betterArmLabel,
  );
  const supportsS1 =
    preferredCondition === 'S1_mini_drama' &&
    rawJudgment?.pairwise_judgment?.better_for_target_reason === true &&
    preferredJudgment?.primary_label === intendedMoveId;
  return {
    schema_version: 'mini-drama-automated-unblinded-result-v0.1',
    packet_id: packet?.packet_id || null,
    raw_judgment_schema_version: rawJudgment?.schema_version || null,
    private_mapping_applied_after_raw_judgment: true,
    intended_move_id: intendedMoveId,
    mapped_arms: mappedArms,
    pairwise_result: {
      better_arm_label: betterArmLabel,
      preferred_condition: preferredCondition,
      supports_s1_for_registered_move: supportsS1,
      score_delta: rawJudgment?.pairwise_judgment?.score_delta ?? null,
    },
    claim_boundary: packet?.claim_boundary || 'simulated_teacher_as_learner_not_human_learning',
    non_claims: packet?.non_claims || [],
  };
}

export function summarizeMiniDramaAutomatedAdjudications(results = [], { minPackets = 3, threshold = 0.8 } = {}) {
  const packetCount = results.length;
  const s1Supported = results.filter((result) => result.pairwise_result?.supports_s1_for_registered_move).length;
  const s0Preferred = results.filter(
    (result) => result.pairwise_result?.preferred_condition === 'S0_shadow_control',
  ).length;
  const unclear = results.filter((result) => result.pairwise_result?.preferred_condition === 'unclear').length;
  const s1Rate = Number((s1Supported / Math.max(1, packetCount)).toFixed(4));
  const meanDelta = Number(
    (
      results.reduce((sum, result) => sum + (Number(result.pairwise_result?.score_delta) || 0), 0) /
      Math.max(1, packetCount)
    ).toFixed(4),
  );
  const systemicDifference = packetCount >= minPackets && s1Rate >= threshold && s0Preferred === 0;
  return {
    schema_version: 'mini-drama-automated-adjudication-summary-v0.1',
    packet_count: packetCount,
    s1_supported_count: s1Supported,
    s0_preferred_count: s0Preferred,
    unclear_count: unclear,
    s1_supported_rate: s1Rate,
    mean_score_delta: meanDelta,
    systemic_difference: systemicDifference,
    result_label: systemicDifference ? 'systemic_s1_mini_drama_greater_than_s0_shadow' : 'no_systemic_difference',
    threshold,
    min_packets: minPackets,
    interpretation_limits: [
      'automated deterministic adjudication, not human coding',
      'mini-drama S1 versus shadow-control S0 is an A19R proxy contrast, not recursive-full A19 transfer',
      'promotion to A19 evidence still requires normal recursive-full S0/S1 and stability gates',
    ],
  };
}
