#!/usr/bin/env node
/**
 * Relay 124 dry preparation: the late presence read of P3, windows-only.
 *
 * Registration: docs/adaptation-refinement/relay/124-registration-late-presence-read.md
 * (sealed 2026-08-17, ruling quoted verbatim: "1 yes, 2 windows only").
 *
 * Zero model calls. Builds the windows-only reader collections and reports the
 * numbers the GO note copies: shard count, planned calls, largest packet.
 *
 * What is frozen and only imported, never edited:
 * - moments and windows: the frozen endpoint scorer's exports;
 * - the reader handbook: the pilot's byte-pinned semantic handbook (hash
 *   checked against the pilot collection manifest's pin);
 * - the packet builder: the frozen preparer, imported FROM THE PARKED
 *   CHECKOUT at the launch commit, so the stored preflight and
 *   schema-acceptance artifacts validate against the commit they are bound
 *   to, and every byte cap it enforces stays as frozen.
 *
 * The one registered amendment (note 124 §4) is packet cutting: the corpus is
 * cut into per-world shards, and each shard's catalogue is the FROZEN
 * catalogue filtered to the targets that world's dialogues mention — every
 * kept entry byte-identical to a frozen entry, checked fail-closed. No cap,
 * definition, or preparer code moves.
 *
 * Usage:
 *   node scripts/prepare-late-presence-read.js --run <run-dir> \
 *     [--frozen-checkout <dir>] [--handbook <file>] [--out-dir <dir>]
 *
 * Exit codes: 0 prepared, 1 a fail-closed check refused, 2 bad input.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { findDeliveredChallenges, findShadowSelections } from './score-guarded-pilot-primary-endpoint.js';
import { readDialogueGateTrace, conditionOfDialogueId } from './score-guarded-pilot-gate.js';

export const LATE_PRESENCE_PREPARATION_SCHEMA =
  'machinespirits.adaptation-refinement.late-presence-read-preparation.v1';

/** The pilot presence collection's pinned handbook hash (its manifest, byte-for-byte). */
export const PILOT_SEMANTIC_HANDBOOK_SHA256 = '0a8e0d29ee870ea9eef1c74dee880c50665f4315950989a42b5bf35e63aa558b';

const DEFAULT_FROZEN_CHECKOUT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../../ms-guarded-readers-pinned',
);
const DEFAULT_HANDBOOK = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../../machinespirits-eval-private/artifacts/adaptive-warrant-outcome-a1/seed-514-instrument-freeze/semantic-annotation-handbook.md',
);
const READER_IDS = Object.freeze(['presence-reader-a', 'presence-reader-b']);
/** Ruling 002: the unread turn stays out of every per-turn series. */
const RULED_OUT_TURNS = Object.freeze([]);

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonical = (value) => JSON.stringify(value);

export function loadDialogues(runDir) {
  const dialoguesDir = path.join(runDir, 'dialogues');
  const dialogues = [];
  for (const name of fs.readdirSync(dialoguesDir).sort()) {
    const dir = path.join(dialoguesDir, name);
    if (!fs.statSync(dir).isDirectory()) continue;
    const trace = readDialogueGateTrace(dir);
    if (trace) dialogues.push({ ...trace, condition: conditionOfDialogueId(name) });
  }
  return dialogues;
}

/** Every turn inside a delivered or shadow reply window, keyed `dialogue#turn`. */
export function windowTurnKeys(dialogues) {
  const moments = { delivered: findDeliveredChallenges(dialogues), shadow: findShadowSelections(dialogues) };
  const keys = new Set();
  for (const side of Object.values(moments)) {
    for (const row of side) for (const turn of row.response_turns) keys.add(`${row.dialogue_id}#${turn}`);
  }
  return { moments, keys };
}

/** Targets a set of key cases mention, from the stored gate/shadow extraction. */
function mentionedTargets(keyCases) {
  const ids = new Set();
  for (const row of keyCases) {
    const extraction = row.gate?.semantic_event_extraction || row.shadow?.semantic_event_extraction || null;
    for (const event of extraction?.events || []) {
      const id = event?.target?.target_id;
      if (id && id !== 'unspecified') ids.add(id);
    }
  }
  return ids;
}

/**
 * The frozen catalogue filtered to a target set. Every kept row is the frozen
 * row itself (same object, so byte-identical on write). Fails closed if the
 * filter would keep nothing.
 */
export function filterCatalog(frozenCatalog, targetIds) {
  const targets = frozenCatalog.targets.filter((row) => targetIds.has(row.target_id));
  if (!targets.length) throw new Error('catalogue filter kept no targets');
  const publicIds = new Set(targets.flatMap((row) => row.public_identifier_ids));
  return {
    schema: frozenCatalog.schema,
    targets,
    public_identifiers: frozenCatalog.public_identifiers.filter((row) => publicIds.has(row.public_identifier_id)),
    components: frozenCatalog.components,
    action_objects: frozenCatalog.action_objects.filter(
      (row) => row.target_id === null || targetIds.has(row.target_id),
    ),
  };
}

/** Fail-closed: every shard catalogue row must be byte-identical to a frozen row. */
function auditCatalogSubset(shardCatalog, frozenCatalog) {
  for (const band of ['targets', 'public_identifiers', 'components', 'action_objects']) {
    const frozenRows = new Set(frozenCatalog[band].map(canonical));
    for (const row of shardCatalog[band]) {
      if (!frozenRows.has(canonical(row))) {
        throw new Error(`shard catalogue ${band} row is not byte-identical to a frozen row`);
      }
    }
  }
}

export async function prepareLatePresenceRead({ runDir, frozenCheckout, handbookPath, outDir }) {
  const resolvedRun = path.resolve(runDir);
  const resolvedCheckout = path.resolve(frozenCheckout);
  const resolvedHandbook = path.resolve(handbookPath);
  const resolvedOut = path.resolve(outDir ?? path.join(resolvedRun, 'late-presence'));

  // The handbook must be the pilot's, byte for byte.
  const handbookSha = sha256(fs.readFileSync(resolvedHandbook));
  if (handbookSha !== PILOT_SEMANTIC_HANDBOOK_SHA256) {
    throw new Error(`handbook hash ${handbookSha} does not match the pilot's pinned handbook`);
  }

  // The frozen preparer, from the parked checkout at the launch commit.
  const preparerUrl = new URL(
    `file://${path.join(resolvedCheckout, 'scripts/prepare-adaptive-warrant-semantic-annotations.js')}`,
  );
  const { prepareAdaptiveWarrantSemanticAnnotationBatches } = await import(preparerUrl.href);

  // Windows-only case list from the frozen moment finders.
  const dialogues = loadDialogues(resolvedRun);
  const { moments, keys } = windowTurnKeys(dialogues);
  for (const ruledOut of RULED_OUT_TURNS) keys.delete(ruledOut);

  const key = readJson(path.join(resolvedRun, 'annotation-key.private.json'));
  const corpus = readJson(path.join(resolvedRun, 'annotation-sample.blinded.json'));
  const keyByTurn = new Map(key.cases.map((row) => [`${row.job_id}#${row.turn}`, row]));
  const corpusById = new Map(corpus.cases.map((row) => [row.sample_id, row]));

  const windowKeyCases = [];
  const unreadableTurns = [];
  for (const turnKey of [...keys].sort()) {
    const row = keyByTurn.get(turnKey);
    if (row && corpusById.has(row.sample_id)) windowKeyCases.push(row);
    else unreadableTurns.push(turnKey); // the ruled-out unread turn has no corpus case
  }

  // Shards per world × condition — the note-124 §4 finer grain. A per-world
  // cut leaves the response schema over the frozen 14,000-byte cap (measured
  // 14,811 and 16,004 bytes); the six world × condition shards fit. Target
  // mining uses ALL of the shard's dialogues' key cases, not only the window
  // ones, so a shard reader never lacks a target its transcripts put in play.
  const shardKeyOf = (row) => `${row.world}--${row.condition}`;
  const shardKeys = [...new Set(windowKeyCases.map(shardKeyOf))].sort();
  const frozenCatalog = corpus.semantic_annotation_catalog;
  fs.mkdirSync(resolvedOut, { recursive: true });

  const shards = [];
  for (const shardKey of shardKeys) {
    const shardKeyCases = windowKeyCases.filter((row) => shardKeyOf(row) === shardKey);
    const shardTargets = mentionedTargets(key.cases.filter((row) => shardKeyOf(row) === shardKey));
    const shardCatalog = filterCatalog(frozenCatalog, shardTargets);
    auditCatalogSubset(shardCatalog, frozenCatalog);
    // Every window case's own extraction targets must sit inside its shard.
    const shardTargetIds = new Set(shardCatalog.targets.map((row) => row.target_id));
    for (const row of shardKeyCases) {
      for (const id of mentionedTargets([row])) {
        if (!shardTargetIds.has(id)) throw new Error(`window case ${row.sample_id} mentions ${id} outside its shard`);
      }
    }

    const shardCorpus = {
      ...corpus,
      cases: shardKeyCases.map((row) => corpusById.get(row.sample_id)),
      semantic_annotation_catalog: shardCatalog,
    };
    const shardDir = path.join(resolvedOut, shardKey);
    fs.mkdirSync(shardDir, { recursive: true });
    const shardCorpusPath = path.join(shardDir, 'corpus.blinded.json');
    fs.writeFileSync(shardCorpusPath, `${JSON.stringify(shardCorpus, null, 2)}\n`);

    const collection = prepareAdaptiveWarrantSemanticAnnotationBatches({
      corpusPath: shardCorpusPath,
      handbookPath: resolvedHandbook,
      outputDir: path.join(shardDir, 'collection'),
      corpusRole: 'targeted_challenge',
      readerIds: [...READER_IDS],
      batchSize: 1,
      maximumCalls: shardKeyCases.length * READER_IDS.length,
      preflightPath: path.join(resolvedRun, 'semantic-brittleness-preflight.json'),
      schemaAcceptancePath: path.join(resolvedRun, 'semantic-schema-acceptance-carryover.json'),
    });
    shards.push({
      shard: shardKey,
      cases: shardKeyCases.length,
      catalog: {
        targets: shardCatalog.targets.length,
        action_objects: shardCatalog.action_objects.length,
        bytes: canonical(shardCatalog).length,
      },
      planned_calls: collection.authorizationRequest.call_budget.planned_calls,
      size_audit: collection.manifest.size_audit,
      collection_manifest: collection.manifestPath,
    });
  }

  const summarizeSide = (rows) => ({
    moments: rows.length,
    with_a_reply_turn: rows.filter((row) => row.response_turns.length > 0).length,
  });
  const manifest = {
    schema: LATE_PRESENCE_PREPARATION_SCHEMA,
    registration: 'relay 124, sealed 2026-08-17, windows-only',
    zero_model_calls: true,
    run_dir: resolvedRun,
    frozen_checkout: resolvedCheckout,
    handbook: { path: resolvedHandbook, sha256: handbookSha },
    windows: {
      delivered: summarizeSide(moments.delivered),
      shadow: summarizeSide(moments.shadow),
      window_turns: keys.size,
      window_cases: windowKeyCases.length,
      turns_without_a_corpus_case: unreadableTurns,
    },
    shards,
    planned_calls_total: shards.reduce((sum, shard) => sum + shard.planned_calls, 0),
    largest_packet_bytes: Math.max(...shards.map((shard) => shard.size_audit.largest_packet_bytes)),
  };
  const manifestPath = path.join(resolvedOut, 'preparation-manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { manifest, manifestPath };
}

async function main() {
  const { values } = parseArgs({
    options: {
      run: { type: 'string' },
      'frozen-checkout': { type: 'string', default: DEFAULT_FROZEN_CHECKOUT },
      handbook: { type: 'string', default: DEFAULT_HANDBOOK },
      'out-dir': { type: 'string' },
    },
  });
  if (!values.run || !fs.existsSync(values.run)) {
    console.error(
      'usage: prepare-late-presence-read.js --run <run-dir> [--frozen-checkout <dir>] [--handbook <file>] [--out-dir <dir>]',
    );
    process.exit(2);
  }
  const { manifest, manifestPath } = await prepareLatePresenceRead({
    runDir: values.run,
    frozenCheckout: values['frozen-checkout'],
    handbookPath: values.handbook,
    outDir: values['out-dir'],
  });
  console.error(
    `windows: ${manifest.windows.window_cases} cases over ${manifest.windows.window_turns} turns ` +
      `(delivered ${manifest.windows.delivered.with_a_reply_turn}, shadow ${manifest.windows.shadow.with_a_reply_turn} moments)`,
  );
  for (const shard of manifest.shards) {
    console.error(
      `shard ${shard.shard}: ${shard.cases} cases, ${shard.planned_calls} planned calls, ` +
        `largest packet ${shard.size_audit.largest_packet_bytes} of ${shard.size_audit.maximum_packet_bytes}`,
    );
  }
  console.error(`total planned calls: ${manifest.planned_calls_total}; manifest: ${manifestPath}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  await main();
}
