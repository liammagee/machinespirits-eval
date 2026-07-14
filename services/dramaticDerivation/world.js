/**
 * World spec loading + validation + plot lint for dramatic derivation.
 *
 * A world is the authored fact-system: rules (public — the learner knows the
 * world's law, it lacks the facts), background facts (the learner's starting
 * GROUNDED set), contingent premises (released only through dramatic action),
 * the secret S, an optional mirror (the authored near-miss), proof paths (the
 * authored DAG — the plot skeleton), a release schedule, and slope
 * constraints. See notes/2026-06-09-dramatic-derivation-plan.md §2.1.
 *
 * `plotLint` is the pre-run leak/slope validation (frozen before any paid
 * run): release prefixes must not entail S before t_min, the full release
 * must entail S, and the mirror must never be entailed.
 */

import fs from 'node:fs';
import yaml from 'yaml';
import { closure, entails, factKey, matchPattern } from './chainer.js';

const RELEASE_VIAS = new Set(['director', 'tutor']);
const RELEASE_PRESENTATION_MODES = new Set(['enacted_role', 'presented_exhibit']);
export const WORLD_ELIGIBILITY_STATUSES = Object.freeze([
  'production',
  'test_only',
  'screen_pending',
  'screen_rejected',
]);
const WORLD_ELIGIBILITY_STATUS_SET = new Set(WORLD_ELIGIBILITY_STATUSES);

export function loadWorld(filePath) {
  const raw = yaml.parse(fs.readFileSync(filePath, 'utf8'));
  return validateWorld(raw, filePath);
}

export function validateWorld(raw, source = '<inline>') {
  const fail = (msg) => {
    throw new Error(`world spec ${source}: ${msg}`);
  };
  if (!raw || typeof raw !== 'object') fail('not an object');
  for (const field of ['id', 'secret', 'rules', 'premises', 'release_schedule', 'slope']) {
    if (!(field in raw)) fail(`missing required field "${field}"`);
  }
  if (!Array.isArray(raw.secret.fact)) fail('secret.fact must be a fact array');
  if (!raw.question) fail('missing "question" (the public dramatic question)');
  if (!Array.isArray(raw.question_pattern)) {
    fail('missing "question_pattern" (the public answer shape, e.g. [heir, "?x"])');
  }

  const premiseById = new Map();
  for (const premise of raw.premises) {
    if (!premise.id || !Array.isArray(premise.fact)) fail('premise needs id + fact array');
    if (premiseById.has(premise.id)) fail(`duplicate premise id "${premise.id}"`);
    premiseById.set(premise.id, premise);
  }
  for (const rule of raw.rules) {
    if (!rule.id || !Array.isArray(rule.if) || !Array.isArray(rule.then)) {
      fail('rule needs id + if[] + then[]');
    }
  }
  for (const entry of raw.release_schedule) {
    if (!Number.isInteger(entry.turn) || entry.turn < 1) fail('release turn must be >= 1');
    if (!premiseById.has(entry.premise)) fail(`release references unknown premise "${entry.premise}"`);
    if (!RELEASE_VIAS.has(entry.via)) fail(`release via must be one of ${[...RELEASE_VIAS]}`);
    if (entry.presentation !== undefined) {
      if (!entry.presentation || typeof entry.presentation !== 'object' || Array.isArray(entry.presentation)) {
        fail('release presentation must be an object when supplied');
      }
      if (!RELEASE_PRESENTATION_MODES.has(entry.presentation.mode)) {
        fail(`release presentation mode must be one of ${[...RELEASE_PRESENTATION_MODES]}`);
      }
      for (const field of ['role', 'cue']) {
        if (entry.presentation[field] !== undefined && !String(entry.presentation[field]).trim()) {
          fail(`release presentation ${field} must be a non-empty string when supplied`);
        }
      }
    }
  }
  const proofPaths = raw.proof_paths || [];
  if (proofPaths.length === 0) fail('at least one proof_path is required (the authored DAG)');
  for (const path of proofPaths) {
    for (const id of path.premises) {
      if (!premiseById.has(id)) fail(`proof_path references unknown premise "${id}"`);
    }
  }
  if (!Number.isInteger(raw.slope.t_min)) fail('slope.t_min must be an integer turn floor');
  if (!Number.isInteger(raw.slope.aporia_window)) fail('slope.aporia_window must be an integer');
  if (!Number.isInteger(raw.turn_cap)) fail('turn_cap must be an integer');

  const eligibility = raw.eligibility || { status: 'production' };
  if (!eligibility || typeof eligibility !== 'object' || Array.isArray(eligibility)) {
    fail('eligibility must be an object when supplied');
  }
  const eligibilityStatus = eligibility.status || 'production';
  if (!WORLD_ELIGIBILITY_STATUS_SET.has(eligibilityStatus)) {
    fail(`eligibility.status must be one of ${WORLD_ELIGIBILITY_STATUSES.join(', ')}`);
  }
  if (eligibilityStatus !== 'production' && !String(eligibility.reason || '').trim()) {
    fail(`eligibility.reason is required when status is ${eligibilityStatus}`);
  }

  const openingFrame = raw.opening_frame || null;
  if (openingFrame !== null) {
    if (!openingFrame || typeof openingFrame !== 'object' || Array.isArray(openingFrame)) {
      fail('opening_frame must be an object when supplied');
    }
    for (const field of ['situation', 'authored_text']) {
      if (
        openingFrame[field] !== undefined &&
        (typeof openingFrame[field] !== 'string' || !openingFrame[field].trim())
      ) {
        fail(`opening_frame.${field} must be a non-empty string when supplied`);
      }
    }
  }

  return Object.freeze({
    id: raw.id,
    title: raw.title || raw.id,
    question: raw.question,
    questionPattern: raw.question_pattern,
    // Authorial fields: K_L prose for the underivability screen + register
    // notes for the real role bridges. Never read by the engine/chainer.
    discipline: raw.discipline || null,
    // Authorial presentation metadata (scenario ecology, narrative diction,
    // picker grouping, in-world ledger term). This is deliberately NOT
    // register: public register controls speech and engagement stance the
    // speaker-hearer relation; presentation is how the author costumes the
    // world. Never read by the engine/chainer.
    presentation: raw.presentation || null,
    // Optional public-only opening authorship. `authored_text` is exact tutor
    // speech; `situation` narrows the public frame supplied to the speaking
    // model. Neither field may carry private proof or future-release content;
    // the tutor-stub opening audit enforces that boundary at realization time.
    openingFrame: openingFrame
      ? Object.freeze({
          situation: String(openingFrame.situation || '').trim() || null,
          authoredText: String(openingFrame.authored_text || '').trim() || null,
        })
      : null,
    // Normal scenario pickers show production worlds only. Non-production
    // worlds remain explicitly addressable by id/path for smoke, screen, and
    // regression work.
    eligibility: Object.freeze({
      status: eligibilityStatus,
      reason: String(eligibility.reason || '').trim() || null,
    }),
    setting: raw.setting || null,
    learnerVoice: raw.learner_voice || null,
    learnerDrift: raw.learner_drift || null,
    ownershipTarget: raw.ownership_target || null,
    cast: raw.cast || null,
    dramaturgy: raw.dramaturgy || null,
    motivation: raw.motivation || null, // CHARACTER-DESIRE.md: authored character desire (per-bearer)
    secret: raw.secret,
    mirror: raw.mirror || null,
    rules: raw.rules,
    premises: raw.premises,
    premiseById,
    background: raw.background || [],
    incompatible: raw.incompatible || [],
    proofPaths,
    releaseSchedule: [...raw.release_schedule].sort((a, b) => a.turn - b.turn),
    slope: raw.slope,
    turnCap: raw.turn_cap,
  });
}

/**
 * Pre-run validation of the authored plot against the slope constraints.
 * Exact (chainer closure), free, and frozen before any generation.
 */
export function plotLint(world) {
  const errors = [];
  const allPremiseFacts = world.premises.map((p) => p.fact);
  const fullBase = [...world.background, ...allPremiseFacts];

  if (!matchPattern(world.questionPattern, world.secret.fact)) {
    errors.push('secret does not match question_pattern (the public question cannot reach S)');
  }
  if (world.mirror && !matchPattern(world.questionPattern, world.mirror.fact)) {
    errors.push('mirror does not match question_pattern (not a candidate answer — not a near-miss)');
  }
  if (entails(world.background, world.rules, world.secret.fact)) {
    errors.push('background alone entails the secret (degenerate leak)');
  }
  if (!entails(fullBase, world.rules, world.secret.fact)) {
    errors.push('full premise set does not entail the secret (drama cannot resolve)');
  }
  if (world.mirror && entails(fullBase, world.rules, world.mirror.fact)) {
    errors.push('mirror is entailed by the full premise set (near-miss is not a near-miss)');
  }

  // Anti-reveal: walk the cumulative release prefixes; the first turn at which
  // the released closure entails S must be >= t_min.
  const released = [...world.background];
  let firstEntailedTurn = null;
  for (const entry of world.releaseSchedule) {
    released.push(world.premiseById.get(entry.premise).fact);
    if (firstEntailedTurn === null && entails(released, world.rules, world.secret.fact)) {
      firstEntailedTurn = entry.turn;
    }
  }
  if (firstEntailedTurn === null) {
    errors.push('release schedule never makes the secret derivable');
  } else if (firstEntailedTurn < world.slope.t_min) {
    errors.push(
      `anti-reveal breach: released closure entails the secret at turn ${firstEntailedTurn} < t_min ${world.slope.t_min}`,
    );
  }

  const scheduled = new Set(world.releaseSchedule.map((entry) => entry.premise));
  const completablePath = world.proofPaths.some((path) => path.premises.every((id) => scheduled.has(id)));
  if (!completablePath) {
    errors.push('no authored proof path is fully covered by the release schedule');
  }
  const lastRelease = world.releaseSchedule[world.releaseSchedule.length - 1];
  if (lastRelease && lastRelease.turn > world.turnCap) {
    errors.push(`release at turn ${lastRelease.turn} exceeds turn_cap ${world.turnCap}`);
  }

  // The secret must not be a verbatim premise/background fact — it has to be
  // EARNED by chaining (minimum depth >= 1).
  const baseKeys = new Set(fullBase.map(factKey));
  if (baseKeys.has(factKey(world.secret.fact))) {
    errors.push('secret is a base fact, not a derivation (no proof DAG to stage)');
  }

  return { ok: errors.length === 0, errors, firstEntailedTurn };
}

/** Closure over a fact list with the world's rules (convenience). */
export function worldClosure(world, facts) {
  return closure(facts, world.rules);
}
