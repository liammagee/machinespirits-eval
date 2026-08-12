#!/usr/bin/env node

/**
 * Zero-call A1 material preparation for the registered warrant outcome study.
 * This module reads local source and writes deterministic material only. It has
 * no provider, child-process, or model-call path.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { parse } from 'acorn';
import yaml from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const OUTCOME_A1_MENU_SCHEMA =
  'machinespirits.adaptation-refinement.warrant-outcome-standing-permission-menu.v1';

export const OUTCOME_A1_SOURCE_PINS = Object.freeze({
  'services/tutorStubWarrantGate.js': 'db30f563bb5107544f0f64677410f3e67cb2f0f2fbe573d4c5d66976b791fc24',
  'services/adaptiveWarrantPolicy.js': '9edce479cca6dfde74a2a48f8321cbd3366ee0a97e4ac3e6565b656de0212c1d',
  'services/tutorStubFirstDraftContract.js': '868c5ef7af8677a59cbf391cc0948c71cb567802e4d7d15d6f980366db707a29',
  'services/tutorStubQuestionSupport.js': '6084936a3dd7093a14b4ef76eb6914549064bf095bf7bc1c8b5e15eba168dfa3',
  'config/engagement-registers.yaml': '6284ffb82d8fe151312c05d6426f809de43addfe5275bbd5f70cbd39361a84c2',
});

export const OUTCOME_A1_ENUMERATION_RULE = Object.freeze({
  action:
    'Include action_families.challenge_resistance.description from the registry and ACTION_CUES.challenge_resistance from the first-draft contract.',
  stance:
    'The challenge-resistance warrant policy fixes stance_hint=precise; include precise.public_signature, precise.stance_contract, and STANCE_EXECUTION_CUES.precise.',
  part:
    'The nonterminal downstream selector assigns nonzero softmax support to every registered actorial part; enumerate every actorial_parts key and require both its registry contract and the same-key PART_CUES entry.',
  tactic:
    'The precise stance selects evidentiary_boundary downstream; include TACTIC_EXECUTION_CUES.evidentiary_boundary.',
  question_support:
    'Walk every tutorInstruction expression branch in buildTutorStubQuestionSupport and include every distinct string literal leaf exactly once.',
});

export const OUTCOME_PILOT_SEEDS = Object.freeze([515, 516, 517]);
export const OUTCOME_PILOT_EXCLUDED_ARTIFACTS = Object.freeze([
  '.tutor-stub-auto-eval/adaptive-warrant-baseline-pilot-v2-live-2026-08-10/annotation-sample.blinded.json',
  '.tutor-stub-auto-eval/adaptive-warrant-baseline-pilot-v2-live-2026-08-10/validation-sample.blinded.json',
  '.tutor-stub-auto-eval/adaptive-warrant-contract-validation-v1-live-2026-08-10/annotation-sample.blinded.json',
  '/private/tmp/adaptive-warrant-mechanism-live-5ddf1d28/annotation-sample.blinded.json',
  '/private/tmp/adaptive-warrant-v3-semantic-diagnostic-3ba68de5/annotation-sample.blinded.json',
  '/private/tmp/adaptive-warrant-v3-semantic-diagnostic-d2bf37c7/annotation-sample.blinded.json',
  '/private/tmp/adaptive-warrant-v3-semantic-diagnostic-7df153d9/annotation-sample.blinded.json',
  '/private/tmp/adaptive-warrant-v3-semantic-diagnostic-225a7b07/annotation-sample.blinded.json',
  '/private/tmp/adaptive-warrant-v3-record-entry-supplement-006-225a7b07/annotation-sample.blinded.json',
  '/private/tmp/adaptive-warrant-v3-matrix-live-36d2e63f/annotation-sample.blinded.json',
  '/private/tmp/adaptive-warrant-v3-matrix-live-d72931bf-s504/annotation-sample.blinded.json',
  '/private/tmp/adaptive-warrant-v3-matrix-live-a4529e79-s505/annotation-sample.blinded.json',
  '/private/tmp/adaptive-warrant-v3-matrix-live-fe2d7a2f-s506/annotation-sample.blinded.json',
  '/private/tmp/adaptive-warrant-v3-matrix-live-bc707cd0-s507/annotation-sample.blinded.json',
  '/private/tmp/adaptive-warrant-v3-matrix-live-0897d030-s508/annotation-sample.blinded.json',
  '/private/tmp/adaptive-warrant-v3-handbook-probe-96bada6e-luna/diagnostic-probe.json',
  '/private/tmp/adaptive-warrant-v3-handbook-probe-39757d4e-sonnet/diagnostic-probe.json',
  '/private/tmp/adaptive-warrant-v3-handbook-probe-2e90d863-s508-luna/diagnostic-probe.json',
  '/private/tmp/adaptive-warrant-v3-handbook-probe-6cbbb8c3-s509-luna/diagnostic-probe.json',
  '/private/tmp/adaptive-warrant-v3-handbook-probe-e34fb6de-s509-luna-block2/diagnostic-probe.json',
  '/private/tmp/adaptive-warrant-v3-handbook-probe-e34fb6de-s509-luna-block3/diagnostic-probe.json',
  '/private/tmp/adaptive-warrant-v3-matrix-live-489f2429-r38-s514/annotation-sample.blinded.json',
]);
export const OUTCOME_PILOT_DEFERENCE_SESSION_IDENTITIES = Object.freeze([
  'gate-smoke/2026-08-09T15-08-12-726Z.jsonl',
  'heldout-borderline/2026-08-09T14-32-40-999Z.jsonl',
  'heldout-validation/2026-08-09T14-50-26-266Z.jsonl',
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath));
}

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit));
    else if (value && typeof value === 'object' && typeof value.type === 'string') walk(value, visit);
  }
}

function objectLiteralMap(sourceText, constantName) {
  const ast = parse(sourceText, { ecmaVersion: 'latest', sourceType: 'module' });
  let objectExpression = null;
  walk(ast, (node) => {
    if (node.type !== 'VariableDeclarator' || node.id?.name !== constantName) return;
    objectExpression = node.init?.type === 'CallExpression' ? node.init.arguments?.[0] : node.init;
  });
  if (objectExpression?.type !== 'ObjectExpression') throw new Error(`missing object constant ${constantName}`);
  return Object.fromEntries(
    objectExpression.properties.map((property) => {
      const key = property.key?.name ?? property.key?.value;
      if (typeof key !== 'string' || property.value?.type !== 'Literal' || typeof property.value.value !== 'string') {
        throw new Error(`${constantName} contains a non-literal entry`);
      }
      return [key, property.value.value];
    }),
  );
}

function tutorInstructionLiterals(sourceText) {
  const ast = parse(sourceText, { ecmaVersion: 'latest', sourceType: 'module' });
  let supportFunction = null;
  walk(ast, (node) => {
    if (node.type === 'FunctionDeclaration' && node.id?.name === 'buildTutorStubQuestionSupport') {
      supportFunction = node;
    }
  });
  if (!supportFunction) throw new Error('missing buildTutorStubQuestionSupport');
  const strings = new Set();
  walk(supportFunction, (node) => {
    const key = node.type === 'Property' ? node.key?.name ?? node.key?.value : null;
    if (key !== 'tutorInstruction') return;
    const collectOutcomes = (value) => {
      if (value?.type === 'Literal' && typeof value.value === 'string') strings.add(value.value);
      else if (value?.type === 'ConditionalExpression') {
        collectOutcomes(value.consequent);
        collectOutcomes(value.alternate);
      } else {
        throw new Error(`unsupported tutorInstruction expression ${value?.type || 'missing'}`);
      }
    };
    collectOutcomes(node.value);
  });
  return [...strings].sort();
}

function descriptivePrefix(kind, key) {
  const prefixes = {
    action_catalogue: 'When the gate selects challenge resistance, its catalogue description is:',
    action_cue: 'When challenge resistance reaches the first-draft action slot, its cue is:',
    stance_public_signature: 'When challenge resistance selects the precise stance, its public signature is:',
    stance_contract: 'When challenge resistance selects the precise stance, its stance contract is:',
    stance_execution: 'When the precise stance reaches first-draft execution, its execution cue is:',
    tactic_execution: 'When the precise stance selects the evidentiary-boundary tactic, its execution cue is:',
    question_support: `When question support sees ${key.replaceAll('_', ' ')}, its tutor instruction is:`,
  };
  if (kind === 'part_contract') {
    return `When the downstream selector chooses the ${key.replaceAll('_', ' ')} part, its part contract is:`;
  }
  if (kind === 'part_execution') {
    return `When the downstream selector chooses the ${key.replaceAll('_', ' ')} part, its first-draft cue is:`;
  }
  return prefixes[kind];
}

function questionSupportBranchKey(quote) {
  const branches = [
    ['Ask one light question', 'a publicly answerable question with no current struggle'],
    ['Directly answer the learner’s outstanding question', 'an unanswered learner question and unreleased evidence ahead'],
    ['Do not ask the learner to invent or name an unseen record, source, person, or fact. Name', 'unreleased evidence ahead without a bounded choice'],
    ['Do not ask the learner to invent or name an unseen record, source, person, or fact. Offer', 'unreleased evidence ahead with a bounded choice'],
    ['First acknowledge that the learner’s question was not answered', 'an unanswered learner question while due evidence is staged'],
    ['Put the directional hint into the discourse', 'public evidence and a struggling learner without a bounded choice'],
    ['Restate the live public clue, then offer', 'public evidence and a struggling learner with a bounded choice'],
    ['State the due evidence in ordinary scene language first, then ask', 'due evidence without a bounded choice'],
    ['State the due evidence in ordinary scene language first, then offer', 'due evidence with a bounded choice'],
  ];
  const match = branches.find(([opening]) => quote.startsWith(opening));
  if (!match) throw new Error(`unclassified question-support branch: ${quote.slice(0, 80)}`);
  return match[1];
}

function sourceRows() {
  const registryPath = 'config/engagement-registers.yaml';
  const firstDraftPath = 'services/tutorStubFirstDraftContract.js';
  const questionSupportPath = 'services/tutorStubQuestionSupport.js';
  const registry = yaml.parse(read(registryPath).toString('utf8'));
  const firstDraft = read(firstDraftPath).toString('utf8');
  const questionSupport = read(questionSupportPath).toString('utf8');
  const actionCues = objectLiteralMap(firstDraft, 'ACTION_CUES');
  const partCues = objectLiteralMap(firstDraft, 'PART_CUES');
  const stanceCues = objectLiteralMap(firstDraft, 'STANCE_EXECUTION_CUES');
  const tacticCues = objectLiteralMap(firstDraft, 'TACTIC_EXECUTION_CUES');
  const rows = [
    {
      id: 'action.catalogue.challenge_resistance',
      kind: 'action_catalogue',
      key: 'challenge_resistance',
      source: `${registryPath}#action_families.challenge_resistance.description`,
      quote: registry.action_families.challenge_resistance.description,
    },
    {
      id: 'action.cue.challenge_resistance',
      kind: 'action_cue',
      key: 'challenge_resistance',
      source: `${firstDraftPath}#ACTION_CUES.challenge_resistance`,
      quote: actionCues.challenge_resistance,
    },
    {
      id: 'stance.public_signature.precise',
      kind: 'stance_public_signature',
      key: 'precise',
      source: `${registryPath}#engagement_stances.precise.public_signature`,
      quote: registry.engagement_stances.precise.public_signature,
    },
    {
      id: 'stance.contract.precise',
      kind: 'stance_contract',
      key: 'precise',
      source: `${registryPath}#engagement_stances.precise.stance_contract|one_line`,
      quote: oneLine(registry.engagement_stances.precise.stance_contract),
    },
    {
      id: 'stance.execution.precise',
      kind: 'stance_execution',
      key: 'precise',
      source: `${firstDraftPath}#STANCE_EXECUTION_CUES.precise`,
      quote: stanceCues.precise,
    },
  ];
  for (const key of Object.keys(registry.actorial_parts).sort()) {
    if (typeof partCues[key] !== 'string') throw new Error(`PART_CUES is missing registered part ${key}`);
    rows.push(
      {
        id: `part.contract.${key}`,
        kind: 'part_contract',
        key,
        source: `${registryPath}#actorial_parts.${key}.contract|one_line`,
        quote: oneLine(registry.actorial_parts[key].contract),
      },
      {
        id: `part.execution.${key}`,
        kind: 'part_execution',
        key,
        source: `${firstDraftPath}#PART_CUES.${key}`,
        quote: partCues[key],
      },
    );
  }
  rows.push({
    id: 'tactic.execution.evidentiary_boundary',
    kind: 'tactic_execution',
    key: 'evidentiary_boundary',
    source: `${firstDraftPath}#TACTIC_EXECUTION_CUES.evidentiary_boundary`,
    quote: tacticCues.evidentiary_boundary,
  });
  tutorInstructionLiterals(questionSupport).forEach((quote) => {
    const key = questionSupportBranchKey(quote);
    const idKey = key.replaceAll(/[^a-z0-9]+/gu, '_').replaceAll(/^_|_$/gu, '');
    rows.push({
      id: `question_support.${idKey}`,
      kind: 'question_support',
      key,
      source: `${questionSupportPath}#buildTutorStubQuestionSupport.tutorInstruction.${key}`,
      quote,
    });
  });
  return rows.map((row) => ({
    id: row.id,
    source: row.source,
    prefix: descriptivePrefix(row.kind, row.key),
    quote: row.quote,
  }));
}

function renderMenu(rows) {
  return rows.map((row) => `${row.prefix}\n<verbatim>\n${row.quote}\n</verbatim>`).join('\n\n');
}

function replaceDeep(value, replacements) {
  if (Array.isArray(value)) return value.map((entry) => replaceDeep(entry, replacements));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, replaceDeep(entry, replacements)]));
  }
  if (typeof value !== 'string') return value;
  return replacements.reduce((text, [from, to]) => text.replaceAll(from, to), value);
}

export function buildOutcomePilotWorlds() {
  const sources = [
    {
      source: 'config/drama-derivation/world-022-foxtrot-jukebox.yaml',
      replacements: [
        ['world_022_foxtrot_jukebox', 'world_101_kestrel_signal_lamp'],
        ['The Case of the Silent Jukebox', 'The Case of the Blind Signal Lamp'],
        ['Waystation Foxtrot', 'Waystation Kestrel'],
        ['Foxtrot', 'Kestrel'],
        ['foxtrot', 'kestrel'],
        ['jukebox', 'signal lamp'],
        ['Jukebox', 'Signal lamp'],
        ['karaoke', 'signal drill'],
        ['Karaoke', 'Signal drill'],
        ['music core', 'message core'],
        ['Moth', 'Kite'],
        ['moth', 'kite'],
        ['Hessa', 'Runa'],
        ['hessa', 'runa'],
        ['cadet', 'apprentice'],
        ['messHall', 'signalRoom'],
        ['mess hall', 'signal room'],
        ['wipePulse', 'faultPulse'],
      ],
    },
    {
      source: 'config/drama-derivation/world-028-larkspur-fridge.yaml',
      replacements: [
        ['world_028_larkspur_fridge', 'world_102_marigold_archive_box'],
        ['The Lunchbox on Shelf Two', 'The Archive Box in Bay Three'],
        ['Larkspur Studio', 'Marigold Archive'],
        ['Larkspur', 'Marigold'],
        ['larkspur', 'marigold'],
        ['lunchbox', 'archive box'],
        ['Lunchbox', 'Archive box'],
        ['fridge', 'records cupboard'],
        ['Fridge', 'Records cupboard'],
        ['shelf two', 'bay three'],
        ['Priya', 'Nadia'],
        ['priya', 'nadia'],
        ['Dario', 'Felix'],
        ['dario', 'felix'],
        ['Wrenfold', 'Osprey'],
        ['wrenfold', 'osprey'],
        ['coordinator', 'archivist'],
        ['incidentLog', 'accessLedger'],
        ['incident log', 'access ledger'],
        ['noonWindow', 'closingWindow'],
        ['noon window', 'closing window'],
        ['kitchen', 'records room'],
      ],
    },
  ];
  return sources.map(({ source, replacements }) => {
    const sourceBytes = read(source);
    const world = replaceDeep(yaml.parse(sourceBytes.toString('utf8')), replacements);
    world.presentation = {
      ...world.presentation,
      outcome_study_fresh_derivation: true,
      source_family_world: yaml.parse(sourceBytes.toString('utf8')).id,
    };
    return { source, source_sha256: sha256(sourceBytes), id: world.id, world };
  });
}

export function writeOutcomePilotWorlds(outputDirectory) {
  const resolvedDirectory = path.resolve(ROOT, outputDirectory);
  fs.mkdirSync(resolvedDirectory, { recursive: true });
  return buildOutcomePilotWorlds().map((entry) => {
    const output = path.join(resolvedDirectory, `${entry.id}.yaml`);
    fs.writeFileSync(output, yaml.stringify(entry.world, { lineWidth: 100 }));
    return { ...entry, output, output_sha256: sha256(fs.readFileSync(output)) };
  });
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function guardOutcomePilotPreparation({ worldPaths, seeds = OUTCOME_PILOT_SEEDS } = {}) {
  const worlds = (worldPaths || []).map((relativePath) => {
    const bytes = read(relativePath);
    const parsed = yaml.parse(bytes.toString('utf8'));
    return { path: relativePath, id: parsed.id, sha256: sha256(bytes) };
  });
  const conditions = ['bare', 'gated', 'standing_permission'];
  const candidates = worlds.flatMap((world) =>
    seeds.flatMap((seed) =>
      conditions.map((condition) => ({
        world: world.id,
        world_sha256: world.sha256,
        seed,
        condition,
        learner_profile: 'low_agency',
        horizon: 8,
      })),
    ),
  );
  const candidateFingerprints = candidates.map((row) =>
    sha256(
      canonicalJson({
        schema: 'machinespirits.adaptation-refinement.outcome-prepared-run-fingerprint.v1',
        ...row,
      }),
    ),
  );
  const exclusions = OUTCOME_PILOT_EXCLUDED_ARTIFACTS.map((artifactPath) => {
    const resolved = path.isAbsolute(artifactPath) ? artifactPath : path.join(ROOT, artifactPath);
    if (!fs.existsSync(resolved)) throw new Error(`required excluded artifact is missing: ${artifactPath}`);
    const bytes = fs.readFileSync(resolved);
    const text = bytes.toString('utf8');
    const embeddedFingerprints = [...new Set(text.match(/[a-f0-9]{64}/gu) || [])];
    return {
      path: artifactPath,
      sha256: sha256(bytes),
      embedded_fingerprint_count: embeddedFingerprints.length,
      embedded_fingerprints: embeddedFingerprints,
      candidate_world_ids_present: worlds.filter((world) => text.includes(world.id)).map((world) => world.id),
    };
  });
  const exclusionFingerprints = new Set(
    exclusions.flatMap((row) => [row.sha256, ...row.embedded_fingerprints]).concat(
      OUTCOME_PILOT_DEFERENCE_SESSION_IDENTITIES.map((identity) =>
        sha256(
          canonicalJson({
            schema: 'machinespirits.adaptation-refinement.archived-deference-session-identity.v1',
            identity,
          }),
        ),
      ),
    ),
  );
  const duplicates = candidateFingerprints.filter(
    (fingerprint, index) => candidateFingerprints.indexOf(fingerprint) !== index,
  );
  const overlaps = candidateFingerprints.filter((fingerprint) => exclusionFingerprints.has(fingerprint));
  const worldIdOverlaps = exclusions.flatMap((row) => row.candidate_world_ids_present);
  const pass =
    worlds.length === 2 &&
    seeds.length === 3 &&
    candidates.length === 18 &&
    duplicates.length === 0 &&
    overlaps.length === 0 &&
    worldIdOverlaps.length === 0;
  return {
    schema: 'machinespirits.adaptation-refinement.outcome-preparation-fingerprint-guard.v1',
    zero_model_calls: true,
    status: pass ? 'passed' : 'failed',
    comparison_scope:
      'Pre-call prepared-run identities are compared with artifact digests and every embedded SHA-256 fingerprint in the burned corpora, the frozen seed-514 matrix, and the three registered archived-session identities. After generation, the same-source annotationCaseFingerprint guard remains mandatory before either reader channel.',
    worlds,
    seeds: [...seeds],
    conditions,
    prepared_run_count: candidates.length,
    candidate_fingerprints: candidateFingerprints,
    excluded_artifacts: exclusions.map(({ embedded_fingerprints: omitted, ...row }) => row),
    deference_session_identities: [...OUTCOME_PILOT_DEFERENCE_SESSION_IDENTITIES],
    exclusion_fingerprint_count: exclusionFingerprints.size,
    duplicate_candidate_fingerprints: [...new Set(duplicates)],
    overlapping_fingerprints: [...new Set(overlaps)],
    overlapping_world_ids: [...new Set(worldIdOverlaps)],
    post_generation_case_guard_required: true,
  };
}

export function buildOutcomeStandingPermissionMenu() {
  const rows = sourceRows();
  return {
    schema: OUTCOME_A1_MENU_SCHEMA,
    source_sha256: { ...OUTCOME_A1_SOURCE_PINS },
    enumeration_rule: { ...OUTCOME_A1_ENUMERATION_RULE },
    prefix_set: rows.map(({ id, prefix }) => ({ id, prefix })),
    entries: rows,
    menu_text: renderMenu(rows),
  };
}

export function guardOutcomeStandingPermissionMenu(material) {
  const sourceChecks = Object.fromEntries(
    Object.entries(OUTCOME_A1_SOURCE_PINS).map(([relativePath, expected]) => {
      const observed = sha256(read(relativePath));
      return [relativePath, { expected, observed, pass: observed === expected }];
    }),
  );
  const expectedRows = sourceRows();
  const actualRows = Array.isArray(material?.entries) ? material.entries : [];
  const expectedById = new Map(expectedRows.map((row) => [row.id, row]));
  const actualById = new Map(actualRows.map((row) => [row.id, row]));
  const duplicateIds = actualRows
    .map((row) => row.id)
    .filter((id, index, ids) => ids.indexOf(id) !== index);
  const missing = expectedRows.filter((row) => !actualById.has(row.id)).map((row) => row.id);
  const unexpected = actualRows.filter((row) => !expectedById.has(row.id)).map((row) => row.id);
  const rowChecks = expectedRows.map((expected) => {
    const actual = actualById.get(expected.id);
    return {
      id: expected.id,
      quote_bytes_match: actual?.quote === expected.quote,
      prefix_bytes_match: actual?.prefix === expected.prefix,
      source_location_match: actual?.source === expected.source,
    };
  });
  const renderedMatches = material?.menu_text === renderMenu(actualRows);
  const pass =
    material?.schema === OUTCOME_A1_MENU_SCHEMA &&
    Object.values(sourceChecks).every((check) => check.pass) &&
    duplicateIds.length === 0 &&
    missing.length === 0 &&
    unexpected.length === 0 &&
    rowChecks.every((row) => row.quote_bytes_match && row.prefix_bytes_match && row.source_location_match) &&
    renderedMatches;
  return {
    schema: 'machinespirits.adaptation-refinement.warrant-outcome-menu-drift-guard.v1',
    zero_model_calls: true,
    status: pass ? 'passed' : 'failed',
    source_checks: sourceChecks,
    expected_entry_count: expectedRows.length,
    observed_entry_count: actualRows.length,
    missing,
    unexpected,
    duplicate_ids: [...new Set(duplicateIds)].sort(),
    rendered_menu_matches_entries: renderedMatches,
    rows: rowChecks,
  };
}

function main() {
  const [flag, outputPath] = process.argv.slice(2);
  if (!outputPath || !['--write-menu', '--write-worlds'].includes(flag)) {
    throw new Error(
      'Usage: node scripts/prepare-adaptive-warrant-outcome-study.js --write-menu <path> | --write-worlds <dir>',
    );
  }
  if (flag === '--write-worlds') {
    const worlds = writeOutcomePilotWorlds(outputPath);
    process.stdout.write(`${JSON.stringify({ worlds }, null, 2)}\n`);
    return;
  }
  const material = buildOutcomeStandingPermissionMenu();
  const guard = guardOutcomeStandingPermissionMenu(material);
  if (guard.status !== 'passed') throw new Error('standing-permission menu drift guard failed');
  const resolved = path.resolve(ROOT, outputPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(material, null, 2)}\n`);
  const textPath = resolved.replace(/\.json$/u, '.txt');
  fs.writeFileSync(textPath, `${material.menu_text}\n`);
  process.stdout.write(
    `${JSON.stringify({ output: resolved, text_output: textPath, entries: material.entries.length, guard }, null, 2)}\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`[outcome-study-a1] ${error.message}`);
    process.exitCode = 1;
  }
}
