/**
 * Catalog-level authoring audit for dramatic-derivation worlds.
 *
 * plotLint proves release safety and eventual entailment. This layer checks
 * the authoring contract around that proof: public glosses, minimal declared
 * paths, complete declaration of alternative paths, explicit evidence roles,
 * mirror incompatibility, presentation metadata, and runtime eligibility.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  auditTutorStubOpening,
  buildTutorStubOpeningFrame,
  deterministicTutorStubOpening,
} from '../tutorStubOpening.js';
import { entails, factKey } from './chainer.js';
import { derivationDistance } from './slope.js';
import { loadWorld, plotLint, WORLD_ELIGIBILITY_STATUSES } from './world.js';

export const WORLD_EVIDENCE_ROLES = Object.freeze([
  'proof',
  'alternative_route',
  'mirror',
  'corroboration',
  'orientation',
  'texture',
]);
const WORLD_EVIDENCE_ROLE_SET = new Set(WORLD_EVIDENCE_ROLES);
const NON_PROGRESS_ROLES = new Set(['mirror', 'corroboration', 'orientation', 'texture']);

function pathKey(ids) {
  return [...new Set(ids)].sort().join('\u0000');
}

function pairKey(left, right) {
  return [factKey(left), factKey(right)].sort().join('\u0000');
}

function minimalEntailingPremiseSets(world) {
  const premises = world.premises;
  if (premises.length > 20) {
    throw new Error(`${world.id}: quality audit supports at most 20 premises; found ${premises.length}`);
  }
  const entailing = [];
  const limit = 1 << premises.length;
  for (let mask = 0; mask < limit; mask += 1) {
    const ids = [];
    const facts = [...world.background];
    for (let index = 0; index < premises.length; index += 1) {
      if (mask & (1 << index)) {
        ids.push(premises[index].id);
        facts.push(premises[index].fact);
      }
    }
    if (!entails(facts, world.rules, world.secret.fact)) continue;
    const minimal = ids.every((removedId) => {
      const reduced = [
        ...world.background,
        ...ids.filter((id) => id !== removedId).map((id) => world.premiseById.get(id).fact),
      ];
      return !entails(reduced, world.rules, world.secret.fact);
    });
    if (minimal) entailing.push(ids);
  }
  return entailing;
}

export function auditWorldQuality(world, { source = world.id } = {}) {
  const errors = [];
  const warnings = [];
  const addError = (code, message) => errors.push({ code, message, source });

  const lint = plotLint(world);
  for (const message of lint.errors) addError('plot_lint', message);

  for (const rule of world.rules) {
    if (!String(rule.gloss || '').trim()) {
      addError('missing_rule_gloss', `${rule.id} needs a learner-facing plain-language gloss`);
    }
  }
  for (const premise of world.premises) {
    if (!String(premise.surface || '').trim()) {
      addError('missing_premise_surface', `${premise.id} needs a learner-facing evidence surface`);
    }
    if (premise.evidence_role && !WORLD_EVIDENCE_ROLE_SET.has(premise.evidence_role)) {
      addError(
        'unknown_evidence_role',
        `${premise.id} evidence_role must be one of ${WORLD_EVIDENCE_ROLES.join(', ')}`,
      );
    }
    if (premise.causal_relation !== undefined) {
      const relation = premise.causal_relation;
      if (
        !relation ||
        typeof relation !== 'object' ||
        Array.isArray(relation) ||
        relation.kind !== 'inactive_candidate_with_persisting_outcome' ||
        relation.family !== 'production' ||
        !String(relation.subject || '').trim() ||
        !String(relation.outcome || '').trim()
      ) {
        addError(
          'invalid_causal_relation',
          `${premise.id} causal_relation must declare inactive_candidate_with_persisting_outcome, production, subject, and outcome`,
        );
      }
    }
  }

  const duplicateFacts = new Map();
  for (const premise of world.premises) {
    const key = factKey(premise.fact);
    if (!duplicateFacts.has(key)) duplicateFacts.set(key, []);
    duplicateFacts.get(key).push(premise);
  }
  for (const group of [...duplicateFacts.values()].filter((rows) => rows.length > 1)) {
    const namedAlternatives = group.every(
      (premise) => premise.evidence_role === 'alternative_route' && String(premise.alternative_group || '').trim(),
    );
    const groupNames = new Set(group.map((premise) => premise.alternative_group));
    if (!namedAlternatives || groupNames.size !== 1) {
      addError(
        'unmarked_duplicate_fact',
        `premises ${group.map((premise) => premise.id).join(', ')} assert the same fact; mark one explicit alternative_group`,
      );
    }
  }

  const declaredPathKeys = new Set();
  for (const [index, proofPath] of world.proofPaths.entries()) {
    const key = pathKey(proofPath.premises);
    if (declaredPathKeys.has(key))
      addError('duplicate_proof_path', `proof path ${index + 1} duplicates an earlier path`);
    declaredPathKeys.add(key);
    for (const premiseId of proofPath.premises) {
      const reduced = [
        ...world.background,
        ...proofPath.premises.filter((id) => id !== premiseId).map((id) => world.premiseById.get(id).fact),
      ];
      if (entails(reduced, world.rules, world.secret.fact)) {
        addError('nonminimal_proof_path', `proof path ${index + 1} still entails the answer without ${premiseId}`);
      }
    }
  }

  const minimalSets = minimalEntailingPremiseSets(world);
  for (const ids of minimalSets) {
    if (!declaredPathKeys.has(pathKey(ids))) {
      addError('undeclared_proof_path', `minimal answer path is undeclared: ${ids.join(', ')}`);
    }
  }
  for (const proofPath of world.proofPaths) {
    if (!minimalSets.some((ids) => pathKey(ids) === pathKey(proofPath.premises))) {
      addError('nonminimal_proof_path', `declared path is not a minimal answer path: ${proofPath.premises.join(', ')}`);
    }
  }

  const scheduledIds = new Set();
  let adopted = [...world.background];
  let distance = derivationDistance(world, adopted);
  for (const entry of world.releaseSchedule) {
    if (scheduledIds.has(entry.premise)) {
      addError('duplicate_release', `${entry.premise} is released more than once`);
    }
    scheduledIds.add(entry.premise);
    const premise = world.premiseById.get(entry.premise);
    adopted = [...adopted, premise.fact];
    const nextDistance = derivationDistance(world, adopted);
    if (nextDistance >= distance && !entry.premise.startsWith('m_') && !NON_PROGRESS_ROLES.has(premise.evidence_role)) {
      addError(
        'unmarked_nonprogress_release',
        `${entry.premise} does not reduce proof distance at turn ${entry.turn}; mark its evidence_role`,
      );
    }
    distance = nextDistance;
  }

  if (world.mirror) {
    const declaredPairs = new Set(world.incompatible.map(([left, right]) => pairKey(left, right)));
    if (!declaredPairs.has(pairKey(world.secret.fact, world.mirror.fact))) {
      addError('missing_answer_incompatibility', 'secret and mirror must be declared incompatible');
    }
  }

  const eligibilityStatus = world.eligibility?.status || 'production';
  if (!WORLD_ELIGIBILITY_STATUSES.includes(eligibilityStatus)) {
    addError('invalid_eligibility', `unknown eligibility status ${eligibilityStatus}`);
  }
  if (eligibilityStatus !== 'production' && !world.eligibility?.reason) {
    addError('missing_eligibility_reason', `${eligibilityStatus} worlds need an eligibility reason`);
  }

  const presentation = world.presentation || {};
  if (!presentation.temporal_frame) addError('missing_presentation', 'presentation.temporal_frame is required');
  for (const field of ['scene_ecology', 'narrative_diction', 'ledger_term', 'summary']) {
    if (!String(presentation[field] || '').trim()) {
      addError('missing_presentation', `world needs explicit presentation.${field}`);
    }
  }

  const openingFrame = buildTutorStubOpeningFrame({
    world,
    openingEvidence: world.releaseSchedule
      .filter((entry) => Number(entry.turn) === 1)
      .map((entry) => ({
        premise: entry.premise,
        via: entry.via,
        surface: world.premiseById.get(entry.premise)?.surface || '',
      })),
  });
  const openingAudit = auditTutorStubOpening({
    text: deterministicTutorStubOpening(openingFrame),
    frame: openingFrame,
    leakAudit: { ok: true, leaks: [] },
  });
  for (const issue of openingAudit.issues) {
    addError('unsafe_opening_fallback', `deterministic opening fails ${issue.type}: ${issue.reason}`);
  }

  return {
    source,
    id: world.id,
    eligibility: eligibilityStatus,
    lint,
    minimalProofPaths: minimalSets,
    errors,
    warnings,
    ok: errors.length === 0,
  };
}

export function auditWorldDirectory(worldDir) {
  const files = fs
    .readdirSync(worldDir)
    .filter((file) => /^world-.*\.yaml$/u.test(file))
    .sort();
  const reports = [];
  for (const file of files) {
    const source = path.join(worldDir, file);
    try {
      reports.push(auditWorldQuality(loadWorld(source), { source }));
    } catch (error) {
      reports.push({
        source,
        id: file,
        eligibility: null,
        lint: null,
        minimalProofPaths: [],
        errors: [{ code: 'load_error', message: error.message, source }],
        warnings: [],
        ok: false,
      });
    }
  }
  const errors = reports.flatMap((report) => report.errors);
  const warnings = reports.flatMap((report) => report.warnings);
  return { worldDir, reports, errors, warnings, ok: errors.length === 0 };
}
