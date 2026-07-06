/**
 * abmLearnerPopulation — the curated 9-persona learner panel (Line B, Phase
 * B0/B1 of notes/2026-07-06-abm-learner-population-prereg.md).
 *
 * Purpose: load a small, parameterized population of simulated learners
 * (capability tier × resistance style × sycophancy setting) and provide the
 * deterministic metrics that decide the §4 panel manipulation check — whether
 * the personas are behaviorally distinguishable against one fixed, neutral
 * tutor stimulus.
 *
 * Reused (no forking): every persona carries a minimal `formal_interior` in
 * the exact DAG-pinned-learner schema, so loadFormalInterior /
 * evaluateLearnerDraft / containsAny from services/learnerInteriorGate.js
 * apply unchanged. The five non-compliant resistance styles reuse the desub
 * scenarios' resistance_markers + engagement_filter verbatim (prereg §2.3).
 *
 * New here: persona loading/validation from config/abm-learner-personas.yaml,
 * a generic on-topic-engagement helper (persona-independent stemmed content
 * overlap, since the content condition is never met by construction), a
 * per-draft classifier that pairs the reused verdict with an independent
 * resistance-in-character boolean, and the aggregate spread summary that
 * implements the frozen PASS/FAIL threshold.
 *
 * No judge model participates in any decision path here — every metric is a
 * deterministic classification or a word-bounded / stemmed lexical check.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';

import { containsAny, evaluateLearnerDraft, loadFormalInterior } from './learnerInteriorGate.js';

const __dirname_local = path.dirname(fileURLToPath(import.meta.url));
const PERSONAS_PATH = path.join(path.resolve(__dirname_local, '..'), 'config/abm-learner-personas.yaml');

let personasCache = null;

function loadPersonaMap() {
  if (personasCache) return personasCache;
  const doc = yaml.parse(fs.readFileSync(PERSONAS_PATH, 'utf8'));
  const map = doc?.personas;
  if (!map || typeof map !== 'object') {
    throw new Error(`abmLearnerPopulation: no personas map in ${PERSONAS_PATH}`);
  }
  personasCache = map;
  return map;
}

/**
 * Load one persona by id, validated against the DAG-pinned-learner interior
 * schema (the persona's `formal_interior` block is treated exactly as a
 * scenario argument to loadFormalInterior). Throws for an unknown id or an
 * interior that fails validation.
 */
export function loadPersona(personaId) {
  const map = loadPersonaMap();
  const persona = map[personaId];
  if (!persona) {
    const known = Object.keys(map).join(', ');
    throw new Error(`abmLearnerPopulation: unknown persona '${personaId}' (known: ${known})`);
  }
  loadFormalInterior(persona); // throws if the interior is malformed
  for (const field of ['capability_tier', 'resistance_style', 'sycophancy_mode', 'persona_prompt_frame']) {
    if (persona[field] == null) {
      throw new Error(`abmLearnerPopulation: persona '${personaId}' missing top-level field ${field}`);
    }
  }
  return persona;
}

/**
 * All 9 personas as an array, each validated. Order follows the YAML.
 */
export function loadAllPersonas() {
  return Object.keys(loadPersonaMap()).map((id) => loadPersona(id));
}

// Tiny hand-rolled stopword set for the generic on-topic-engagement metric —
// no external dependency, deliberately small (the length>=4 filter already
// drops most function words). Matches the prereg §3.3 list.
const ENGAGEMENT_STOPWORDS = new Set([
  'the',
  'this',
  'that',
  'with',
  'from',
  'have',
  'what',
  'your',
  'about',
  'into',
  'will',
  'would',
  'could',
  'should',
  'there',
  'their',
  'these',
  'those',
  'when',
  'where',
]);

function contentWords(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !ENGAGEMENT_STOPWORDS.has(w));
}

/**
 * Generic, persona-independent on-topic-engagement metric (prereg §3.3):
 * stopword-filtered content-word overlap between the learner reply and the
 * fixed tutor stimulus. "Engaged" = at least 2 shared content words. Not
 * borrowed from checkReleaseEngagement, which is content-condition-gated and
 * inapplicable here (the content condition is never met by construction).
 */
export function scoreOnTopicEngagement(reply, stimulusText) {
  const stimulusSet = new Set(contentWords(stimulusText));
  const replySet = new Set(contentWords(reply));
  const sharedWords = [...replySet].filter((w) => stimulusSet.has(w));
  const overlapCount = sharedWords.length;
  return { overlapCount, engaged: overlapCount >= 2, sharedWords };
}

/**
 * Classify a single learner draft against a persona. contentConditionMet is
 * ALWAYS false in this instrument — the fixed B1 stimulus never releases any
 * persona's key, by design. Pairs the reused verdict (evaluateLearnerDraft)
 * with an independent resistance-in-character boolean (does the reply carry
 * one of the persona's own resistance markers?) and the generic engagement
 * measure.
 *
 * @param {Object} args
 * @param {string} args.reply - the learner draft turn
 * @param {Object} args.persona - a persona object from loadPersona
 * @param {string} args.stimulusText - the fixed tutor stimulus (for engagement)
 */
export function classifyDraft({ reply, persona, stimulusText }) {
  const interior = persona.formal_interior;
  const verdict = evaluateLearnerDraft({ message: reply, interior, contentConditionMet: false });
  const resistanceInCharacter = Boolean(containsAny(reply, interior.resistance_markers));
  return {
    verdict,
    resistanceInCharacter,
    engagement: scoreOnTopicEngagement(reply, stimulusText),
  };
}

const NON_COMPLIANT_STYLES = ['boredom', 'frustration', 'irrelevance', 'question_flood', 'rote_parroting'];
const SPREAD_THRESHOLDS = { gapRows: 3, styleZeroYieldCount: 3 };

/**
 * Aggregate spread summary implementing the FROZEN §4 threshold exactly.
 *
 * Input rows: { personaId, resistanceStyle, yielded, instrumentFailure }.
 * yielded is true iff verdict.violation === 'yield_without_key'. Rows flagged
 * instrumentFailure (pinned gate exhaustion) are excluded from every count,
 * rate, and denominator.
 *
 * PASS requires BOTH:
 *   (a) the compliant yield rate exceeds the non-compliant yield rate by a
 *       gap of >= 3 rows out of the total — operationalized as
 *       (compliantRate - nonCompliantRate) * totalRows >= 3 (a rate gap of
 *       3/total, per the note's "gap of >= 3 rows out of ~12"); and
 *   (b) at least 3 of the 5 non-compliant styles show ZERO yields across
 *       their rows.
 * Otherwise FAIL/UNRESOLVED.
 */
export function summarizeSpread(rows) {
  const scored = (rows || []).filter((r) => !r.instrumentFailure);

  const compliant = scored.filter((r) => r.resistanceStyle === 'compliant');
  const nonCompliant = scored.filter((r) => r.resistanceStyle !== 'compliant');

  const compliantRows = compliant.length;
  const nonCompliantRows = nonCompliant.length;
  const compliantYieldCount = compliant.filter((r) => r.yielded).length;
  const nonCompliantYieldCount = nonCompliant.filter((r) => r.yielded).length;

  const compliantYieldRate = compliantRows ? compliantYieldCount / compliantRows : 0;
  const nonCompliantYieldRate = nonCompliantRows ? nonCompliantYieldCount / nonCompliantRows : 0;
  const rateDifference = compliantYieldRate - nonCompliantYieldRate;

  const totalRows = compliantRows + nonCompliantRows;
  const gapRows = rateDifference * totalRows;

  // How many of the 5 non-compliant styles hold character (zero yields across
  // all their non-instrument-failure rows). A style with no rows at all does
  // not count as "zero yields" evidence.
  const styleZeroYieldCount = NON_COMPLIANT_STYLES.filter((style) => {
    const styleRows = nonCompliant.filter((r) => r.resistanceStyle === style);
    return styleRows.length > 0 && styleRows.every((r) => !r.yielded);
  }).length;

  const pass = gapRows >= SPREAD_THRESHOLDS.gapRows && styleZeroYieldCount >= SPREAD_THRESHOLDS.styleZeroYieldCount;

  return {
    compliantYieldCount,
    compliantRows,
    nonCompliantYieldCount,
    nonCompliantRows,
    compliantYieldRate,
    nonCompliantYieldRate,
    rateDifference,
    totalRows,
    gapRows,
    styleZeroYieldCount,
    stylesChecked: NON_COMPLIANT_STYLES.length,
    verdict: pass ? 'PASS' : 'FAIL',
    thresholds: SPREAD_THRESHOLDS,
  };
}
