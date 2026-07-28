import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import yaml from 'yaml';

export const PROGRAM2_PHASE5E_WORLD_SELECTION_SCHEMA = 'machinespirits.program2.phase5e-world-selection.v1';
export const PROGRAM2_PHASE5E_FROZEN_SIX = Object.freeze(['evidence', 'item', 'test', 'record', 'fact', 'rule']);
export const PROGRAM2_PHASE5E_STRUCTURE_RULE_FLOOR = 5;
export const PROGRAM2_PHASE5E_CANDIDATE_FILES = Object.freeze([
  'world-022-foxtrot-jukebox.yaml',
  'world-023-greyfen-lab.yaml',
  'world-024-emberwick-forum.yaml',
  'world-025-tallow-street.yaml',
  'world-026-skyway-bakery.yaml',
  'world-028-larkspur-fridge.yaml',
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function wordRegex(word) {
  return new RegExp(`\\b${word}(?:'?s|es)?\\b`, 'giu');
}

function wordCount(text) {
  return (String(text).match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) || []).length;
}

export function countProgram2Phase5eFrozenSixUnits(units) {
  const perCue = Object.fromEntries(PROGRAM2_PHASE5E_FROZEN_SIX.map((cue) => [cue, 0]));
  let unitsWithCue = 0;
  let totalOccurrences = 0;
  let totalWords = 0;
  for (const unit of units) {
    const text = typeof unit === 'string' ? unit : unit?.text || '';
    totalWords += wordCount(text);
    let unitHit = false;
    for (const cue of PROGRAM2_PHASE5E_FROZEN_SIX) {
      const matches = [...text.matchAll(wordRegex(cue))];
      perCue[cue] += matches.length;
      totalOccurrences += matches.length;
      if (matches.length) unitHit = true;
    }
    if (unitHit) unitsWithCue += 1;
  }
  return {
    units: units.length,
    unitsWithCue,
    unitCueRate: units.length ? unitsWithCue / units.length : null,
    totalOccurrences,
    occurrencesPer1kWords: totalWords ? (totalOccurrences / totalWords) * 1000 : null,
    totalWords,
    perCue,
  };
}

const NON_PROSE_KEYS = new Set([
  'id',
  'fact',
  'if',
  'then',
  'question_pattern',
  'background',
  'incompatible',
  'proof_paths',
  'release_schedule',
]);

function proseText(value, key = null) {
  if (NON_PROSE_KEYS.has(key)) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap((entry) => proseText(entry, key));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([childKey, child]) => proseText(child, childKey));
  }
  return [];
}

export function measureProgram2Phase5eWorld(filePath) {
  const bytes = fs.readFileSync(filePath);
  const sourceText = bytes.toString('utf8');
  const world = yaml.parse(sourceText);
  const text = proseText(world).join('\n');
  const words = wordCount(text);
  const cueCounts = Object.fromEntries(
    PROGRAM2_PHASE5E_FROZEN_SIX.map((cue) => [cue, [...text.matchAll(wordRegex(cue))].length]),
  );
  const cueMatches = Object.values(cueCounts).reduce((sum, count) => sum + count, 0);
  const rules = Array.isArray(world?.rules) ? world.rules.length : 0;
  const premises = Array.isArray(world?.premises) ? world.premises.length : 0;
  return {
    worldId: world?.id || path.basename(filePath, path.extname(filePath)),
    title: world?.title || null,
    file: path.basename(filePath),
    sha256: sha256(bytes),
    words,
    cueMatches,
    cueMatchesPer1kWords: words ? (cueMatches / words) * 1000 : null,
    cueCounts,
    premises,
    rules,
    proofPaths: Array.isArray(world?.proof_paths) ? world.proof_paths.length : 0,
    structureFloorPassed: rules >= PROGRAM2_PHASE5E_STRUCTURE_RULE_FLOOR,
  };
}

function metricOrder(left, right) {
  return (
    left.cueMatchesPer1kWords - right.cueMatchesPer1kWords ||
    right.rules - left.rules ||
    left.worldId.localeCompare(right.worldId)
  );
}

export function selectProgram2Phase5eWorld({ worldDir, candidateFiles = PROGRAM2_PHASE5E_CANDIDATE_FILES } = {}) {
  if (!worldDir) throw new Error('worldDir is required');
  const candidates = candidateFiles
    .map((file) => measureProgram2Phase5eWorld(path.join(worldDir, file)))
    .sort(metricOrder);
  const nativeWinner = candidates[0] || null;
  const floorCandidates = candidates.filter((candidate) => candidate.structureFloorPassed);
  const selected = floorCandidates[0] || nativeWinner;
  return {
    schema: PROGRAM2_PHASE5E_WORLD_SELECTION_SCHEMA,
    frozenSix: [...PROGRAM2_PHASE5E_FROZEN_SIX],
    metric:
      'case-insensitive word-boundary counts with possessive/plural suffixes over parsed world prose (setting, questions, glosses, surfaces, and dramaturgy), excluding formal facts/rules/schedules, per 1,000 words',
    structureRuleFloor: PROGRAM2_PHASE5E_STRUCTURE_RULE_FLOOR,
    candidates,
    nativeWinner: nativeWinner?.worldId || null,
    selectedWorld: selected?.worldId || null,
    selectedFile: selected?.file || null,
    selectionReason:
      nativeWinner && selected && nativeWinner.worldId !== selected.worldId
        ? `${nativeWinner.worldId} is the raw letter-hostility winner but has ${nativeWinner.rules} rules; selected ${selected.worldId}, the lowest-density candidate meeting the >=${PROGRAM2_PHASE5E_STRUCTURE_RULE_FLOOR}-rule floor.`
        : selected
          ? `${selected.worldId} is the lowest-density candidate and meets the >=${PROGRAM2_PHASE5E_STRUCTURE_RULE_FLOOR}-rule floor.`
          : 'No candidate worlds were measured.',
  };
}

export function renderProgram2Phase5eWorldSelectionMarkdown(result) {
  const rows = result.candidates.map(
    (candidate, index) =>
      `| ${index + 1} | ${candidate.worldId} | ${candidate.cueMatches} | ${candidate.words} | ${candidate.cueMatchesPer1kWords.toFixed(2)} | ${candidate.premises} | ${candidate.rules} | ${candidate.structureFloorPassed ? 'yes' : 'no'} |`,
  );
  return `${[
    '# Program-2 Phase 5e world selection',
    '',
    `Selected: **${result.selectedWorld}**.`,
    '',
    result.selectionReason,
    '',
    '| Rank | World | Frozen-six matches | Words | Matches/1k | Premises | Rules | Structure floor |',
    '| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |',
    ...rows,
    '',
    `Metric: ${result.metric}.`,
  ].join('\n')}\n`;
}
