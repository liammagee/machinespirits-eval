#!/usr/bin/env node
/**
 * Late presence read — assembly and scoring adapter (relay 124 §3, §5).
 *
 * Zero model calls. This script runs AFTER the approved paid read. Per shard
 * it drives the frozen assembler on the launcher's responses, then merges the
 * shard assemblies into the two run-root reader files the frozen endpoint
 * scorer expects, and scores through that scorer unchanged.
 *
 * Frozen files are imported, never edited:
 *   - `assembleAdaptiveWarrantSemanticAnnotationResponse` and
 *     `writeOutcomePilotAssemblyRunView` from the parked checkout;
 *   - `scoreGuardedPilotPrimaryEndpoint` and `GUARDED_MAIN_BLOCK_SHAPE`
 *     from this repo's frozen scorers.
 * Stored artifacts are read, never overwritten: the script refuses to run if
 * any output file already exists.
 *
 * Usage:
 *   node scripts/score-late-presence-read.js --run <run-dir> [--frozen-checkout <dir>]
 *
 * Expects each shard's paid responses at `late-presence/<shard>/responses`
 * (the launcher's --out), holding `semantic-reader-run.json` and one
 * directory per reader.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { scoreGuardedPilotPrimaryEndpoint } from './score-guarded-pilot-primary-endpoint.js';
import { GUARDED_MAIN_BLOCK_SHAPE } from './score-guarded-pilot-gate.js';
import { LATE_PRESENCE_PREPARATION_SCHEMA } from './prepare-late-presence-read.js';
import { recordObservedDigest } from '../services/recordedFileDigest.js';

export const LATE_PRESENCE_SCORE_SCHEMA = 'machinespirits.adaptation-refinement.late-presence-read-score.v1';
export const LATE_PRESENCE_MERGED_ASSEMBLY_SCHEMA =
  'machinespirits.adaptation-refinement.late-presence-merged-assembly.v1';
/** The one label this read may carry, wherever it is cited (relay 124 §2). */
export const LATE_PRESENCE_LABEL = 'late-scored registered endpoint, disclosed instrument amendment';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DEFAULT_FROZEN_CHECKOUT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../../ms-guarded-readers-pinned',
);
const READER_IDS = Object.freeze(['presence-reader-a', 'presence-reader-b']);

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const fileSha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function refuseExisting(file) {
  if (fs.existsSync(file)) throw new Error(`refusing to overwrite existing file: ${file}`);
}

const RULING_003_PATH = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../docs/adaptation-refinement/guarded-main-block/reviewer-ruling-003-malformed-event-drop.json',
);
const RULING_004_PATH = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../docs/adaptation-refinement/guarded-main-block/reviewer-ruling-004-quarantined-reading-retake.json',
);

/**
 * Rulings 003 and 004 both make a reader's derived response bytes differ from
 * the launcher's pinned ones, so the frozen assembler must run without its run
 * record for that reader. This replicates, freely and first, the model-run
 * verification the assembler would have performed — against the launcher run
 * record and the ORIGINAL files.
 */
function replicateRunVerification({ view, manifest, readerId, responsesDir }) {
  const run = view.run;
  if (run.status !== 'complete' || run.study_id !== manifest.study_id || run.source_commit !== manifest.source_commit) {
    throw new Error('run record is not a complete source-bound reader run');
  }
  const reader = manifest.readers.find((row) => row.reader_id === readerId);
  const [provider, ...modelRest] = run.model.split('.');
  for (const batch of reader.batches) {
    const responsePath = path.join(responsesDir, readerId, batch.expected_response_filename);
    const runBatch = run.batches.find((row) => row.reader_id === readerId && row.batch_id === batch.batch_id);
    const attested =
      runBatch?.model_independently_attested === true ||
      (runBatch?.model_attestation_basis === 'explicit_cli_model_argument_accepted_bridge_echo' &&
        runBatch.returned_provider === provider &&
        runBatch.returned_model === modelRest.join('.') &&
        runBatch.model_independently_attested === false);
    if (
      runBatch?.status !== 'complete' ||
      runBatch.response_path !== responsePath ||
      runBatch.response_sha256 !== fileSha256(responsePath) ||
      !attested ||
      Number(runBatch.prohibited_tool_event_count || 0) !== 0
    ) {
      throw new Error(`${batch.batch_id} lacks verified model-run evidence (free replication, rulings 003/004)`);
    }
  }
}

/**
 * Build the ruled reader's derived response dir: every file byte-identical
 * except the ruled transformations — ruling 003 drops (an event spliced out)
 * and ruling 004 substitutions (a quarantined case row replaced by the
 * retaken reading's raw row, which already passed the full frozen assembler
 * inside its own retake collection). Originals are never touched.
 */
function deriveRuledResponses({ shard, readerId, drops, subs, responsesDir, shardDir }) {
  const derivedDir = path.join(shardDir, 'responses-ruled', readerId);
  refuseExisting(derivedDir);
  fs.mkdirSync(derivedDir, { recursive: true });
  const appliedDrops = [];
  const appliedSubs = [];
  for (const name of fs.readdirSync(path.join(responsesDir, readerId))) {
    const source = path.join(responsesDir, readerId, name);
    const target = path.join(derivedDir, name);
    const drop = drops.find((row) => row.response_file === name);
    const sub = subs.find((row) => row.reading.response_file === name);
    if (drop && sub) throw new Error(`${shard.shard}/${readerId}/${name}: file is both dropped and substituted`);
    if (!drop && !sub) {
      fs.copyFileSync(source, target);
      continue;
    }
    const pin = drop ? drop.response_sha256 : sub.reading.response_sha256;
    const rulingId = drop ? '003' : '004';
    if (fileSha256(source) !== pin) {
      throw new Error(
        `${shard.shard}/${readerId}/${name}: response file does not match ruling ${rulingId}'s pinned hash`,
      );
    }
    const response = readJson(source);
    if (drop) {
      const events = response.cases_by_sample_id[drop.sample_id].events;
      const removed = events.splice(drop.event_index, 1)[0];
      if (removed?.speech_act !== drop.speech_act) {
        throw new Error(`${shard.shard}/${readerId}/${name}: event at index ${drop.event_index} is not the ruled one`);
      }
    } else {
      const sampleId = sub.reading.sample_id;
      if (!response.cases_by_sample_id[sampleId]) {
        throw new Error(`${shard.shard}/${readerId}/${name}: quarantined case ${sampleId} is not in this response`);
      }
      response.cases_by_sample_id[sampleId] = sub.retake_row;
    }
    fs.writeFileSync(target, JSON.stringify(response));
    const record = { derived_path: target, derived_sha256: fileSha256(target) };
    if (drop) appliedDrops.push({ ...drop, ...record });
    else appliedSubs.push({ ...sub.reading, retake: sub.retake_source, ...record });
  }
  if (appliedDrops.length !== drops.length || appliedSubs.length !== subs.length) {
    throw new Error(
      `${shard.shard}/${readerId}: rulings list ${drops.length} drops and ${subs.length} substitutions, ` +
        `applied ${appliedDrops.length} and ${appliedSubs.length}`,
    );
  }
  return { derivedDir, appliedDrops, appliedSubs };
}

/** Assemble one shard's paid responses through the frozen assembler. */
export function assembleShard({ shard, frozen, runBase, ruling, substitutions }) {
  const shardDir = path.join(runBase, 'late-presence', shard.shard);
  const responsesDir = path.join(shardDir, 'responses');
  const runPath = path.join(responsesDir, 'semantic-reader-run.json');
  if (!fs.existsSync(runPath)) throw new Error(`${shard.shard}: no reader run at ${runPath}`);
  const view = frozen.writeOutcomePilotAssemblyRunView({
    runPath,
    outputPath: path.join(shardDir, 'assembly-run-view.json'),
  });
  const manifest = readJson(shard.collection_manifest);
  const readers = {};
  const ruledDrops = [];
  const ruledSubs = [];
  for (const readerId of READER_IDS) {
    const drops = ruling.dropped_events.filter((row) => row.shard === shard.shard && row.reader === readerId);
    const subs = substitutions.filter((row) => row.reading.shard === shard.shard && row.reading.reader === readerId);
    let responseDir = path.join(responsesDir, readerId);
    let assemblyRunPath = view.path;
    if (drops.length || subs.length) {
      replicateRunVerification({ view, manifest, readerId, responsesDir });
      const derived = deriveRuledResponses({ shard, readerId, drops, subs, responsesDir, shardDir });
      responseDir = derived.derivedDir;
      assemblyRunPath = null;
      ruledDrops.push(...derived.appliedDrops);
      ruledSubs.push(...derived.appliedSubs);
    }
    const outputPath = path.join(shardDir, `${readerId}.assembled.json`);
    const assembled = frozen.assembleAdaptiveWarrantSemanticAnnotationResponse({
      manifestPath: shard.collection_manifest,
      readerId,
      annotationRunId: `late-presence-${shard.shard}-${readerId}`,
      responseDir,
      outputPath,
      runPath: assemblyRunPath,
    });
    readers[readerId] = assembled;
  }
  return { shard: shard.shard, readers, ruledDrops, ruledSubs };
}

/**
 * Ruling 004: verify the retake calls and load the retaken readings. Paid
 * provenance for all six calls (forced extra included) is checked by the
 * same free run-record replication ruling 003 uses; the five consumed rows
 * then receive the FULL frozen validation inside the shard assemblies they
 * are substituted into (spans, catalog binding, ambiguity rules — same
 * catalog, same learner text). A wholesale frozen assembly of each retake
 * collection is attempted and recorded, but cannot be required: the forced
 * extra reading (never quarantined, ruled stored/disclosed/unused) sits in
 * the same collection, and if IT is assembly-invalid the collection cannot
 * assemble even though the ruled design never uses that reading. The frozen
 * validator also requires every shard assembly to cover its corpus exactly,
 * so the ruled "omit and slot in at merge" is realized one stage earlier, as
 * a disclosed case-row substitution in derived response copies.
 */
function loadRetakenReadings({ retakePrep, ruling, frozen, runBase }) {
  const collections = [];
  const substitutions = [];
  for (const group of retakePrep.groups) {
    const groupDir = path.join(runBase, 'late-presence', 'retakes', group.shard);
    const responsesDir = path.join(groupDir, 'responses');
    const runPath = path.join(responsesDir, 'semantic-reader-run.json');
    if (!fs.existsSync(runPath)) throw new Error(`retake ${group.shard}: no reader run at ${runPath}`);
    const view = frozen.writeOutcomePilotAssemblyRunView({
      runPath,
      outputPath: path.join(groupDir, 'assembly-run-view.json'),
    });
    const manifest = readJson(group.collection_manifest);
    for (const readerId of READER_IDS) {
      replicateRunVerification({ view, manifest, readerId, responsesDir });
      let attempt;
      try {
        const assembled = frozen.assembleAdaptiveWarrantSemanticAnnotationResponse({
          manifestPath: group.collection_manifest,
          readerId,
          annotationRunId: `late-presence-retake-${group.shard}-${readerId}`,
          responseDir: path.join(responsesDir, readerId),
          outputPath: path.join(groupDir, `${readerId}.assembled.json`),
          runPath: view.path,
        });
        attempt = { ok: true, path: assembled.outputPath, sha256: fileSha256(assembled.outputPath) };
      } catch (error) {
        attempt = { ok: false, frozen_assembler_error: error.message };
      }
      collections.push({ shard: group.shard, reader_id: readerId, wholesale_assembly_attempt: attempt });
    }
    for (const reading of ruling.quarantined_readings.filter((row) => row.shard === group.shard)) {
      const manifestReader = manifest.readers.find((row) => row.reader_id === reading.reader);
      const batch = manifestReader?.batches.find((row) => row.required_sample_ids.includes(reading.sample_id));
      if (!batch) throw new Error(`retake ${group.shard}: no batch holds ${reading.reader} ${reading.sample_id}`);
      const responsePath = path.join(responsesDir, reading.reader, batch.expected_response_filename);
      const response = readJson(responsePath);
      const ids = Object.keys(response.cases_by_sample_id || {}).sort();
      if (
        response.reader_id !== reading.reader ||
        response.batch_id !== batch.batch_id ||
        response.study_id !== manifest.study_id ||
        response.corpus_sha256 !== manifest.corpus.sha256 ||
        JSON.stringify(ids) !== JSON.stringify([...batch.required_sample_ids].sort())
      ) {
        throw new Error(`retake ${group.shard}: ${batch.batch_id} response does not bind its packet`);
      }
      const retakeRow = response.cases_by_sample_id[reading.sample_id];
      substitutions.push({
        reading,
        retake_row: retakeRow,
        retake_source: {
          batch_id: batch.batch_id,
          response_path: responsePath,
          response_sha256: fileSha256(responsePath),
        },
      });
    }
  }
  return { collections, substitutions };
}

/**
 * Merge the shard assemblies into one run-root file per reader — the file
 * name and `.cases` shape the frozen `readPresenceActs` reads. Fail-closed:
 * no duplicate sample ids, and the merged set must equal the union of the
 * shard corpora exactly.
 */
export function mergeAssemblies({ prep, shardAssemblies, runBase }) {
  const corpus = readJson(path.join(runBase, 'annotation-sample.blinded.json'));
  const order = new Map(corpus.cases.map((row, index) => [row.sample_id, index]));
  const expected = new Set();
  for (const shard of prep.shards) {
    for (const row of readJson(path.join(runBase, 'late-presence', shard.shard, 'corpus.blinded.json')).cases) {
      if (expected.has(row.sample_id)) throw new Error(`shard corpora overlap on ${row.sample_id}`);
      expected.add(row.sample_id);
    }
  }
  if (expected.size !== prep.windows.window_cases) {
    throw new Error(`shard corpora hold ${expected.size} cases, preparation says ${prep.windows.window_cases}`);
  }
  const merged = {};
  for (const readerId of READER_IDS) {
    const seen = new Set();
    const cases = [];
    const sources = [];
    for (const entry of shardAssemblies) {
      const assembled = entry.readers[readerId];
      for (const row of assembled.response.cases) {
        if (seen.has(row.sample_id)) throw new Error(`${readerId}: duplicate sample ${row.sample_id}`);
        if (!expected.has(row.sample_id)) throw new Error(`${readerId}: unexpected sample ${row.sample_id}`);
        seen.add(row.sample_id);
        cases.push(row);
      }
      sources.push({
        shard: entry.shard,
        path: assembled.outputPath,
        sha256: fileSha256(assembled.outputPath),
        cases: assembled.response.cases.length,
      });
    }
    if (seen.size !== expected.size) {
      throw new Error(`${readerId}: merged ${seen.size} cases, expected ${expected.size}`);
    }
    cases.sort((left, right) => order.get(left.sample_id) - order.get(right.sample_id));
    const outputPath = path.join(runBase, `${readerId}.assembled.json`);
    refuseExisting(outputPath);
    const body = {
      schema: LATE_PRESENCE_MERGED_ASSEMBLY_SCHEMA,
      study_id: corpus.study_id,
      annotator_id: readerId,
      label: LATE_PRESENCE_LABEL,
      registration: 'docs/adaptation-refinement/relay/124-registration-late-presence-read.md',
      sources,
      cases,
    };
    fs.writeFileSync(outputPath, `${JSON.stringify(body, null, 2)}\n`);
    merged[readerId] = { path: outputPath, sha256: fileSha256(outputPath), cases: cases.length };
  }
  return merged;
}

/** Side report: the shadow arm split by condition (relay 124 §5, description only). */
export function shadowByCondition(result) {
  const split = {};
  for (const row of result.shadow_selections) {
    if (!row.response_turns.length) continue;
    const arm = (split[row.condition] ||= { moments: 0, both_readers: 0 });
    arm.moments += 1;
    if (row.readers_seeing_evidence === 2) arm.both_readers += 1;
  }
  for (const arm of Object.values(split)) {
    arm.rate = arm.moments ? Number((arm.both_readers / arm.moments).toFixed(3)) : null;
  }
  return split;
}

/**
 * Side report: agreement between this read and relay 123's decision-tag read
 * on the same windows (relay 124 §5, description only).
 */
export function agreementWithRebase({ result, rebase }) {
  const compare = (presenceRows, rebaseRows, side) => {
    const tags = new Map(rebaseRows.map((row) => [`${row.dialogue_id}#${row.turn}`, row.evidence_move]));
    const table = { both_yes: 0, presence_only: 0, rebase_only: 0, both_no: 0, unmatched: 0 };
    for (const row of presenceRows) {
      if (!row.response_turns.length) continue;
      const tag = tags.get(`${row.dialogue_id}#${row.turn}`);
      if (tag === undefined) {
        table.unmatched += 1;
        continue;
      }
      const presenceYes = row.readers_seeing_evidence === 2;
      if (presenceYes && tag) table.both_yes += 1;
      else if (presenceYes) table.presence_only += 1;
      else if (tag) table.rebase_only += 1;
      else table.both_no += 1;
    }
    const matched = table.both_yes + table.presence_only + table.rebase_only + table.both_no;
    return {
      side,
      windows_compared: matched,
      ...table,
      agreement_rate: matched ? Number(((table.both_yes + table.both_no) / matched).toFixed(3)) : null,
    };
  };
  return {
    rebase_registration: rebase.registration,
    delivered: compare(result.challenges, rebase.window_detail.delivered, 'delivered'),
    shadow: compare(result.shadow_selections, rebase.window_detail.shadow, 'shadow'),
  };
}

export function scoreLatePresenceRead({ runDir, frozenCheckout = DEFAULT_FROZEN_CHECKOUT } = {}) {
  const runBase = path.resolve(runDir);
  const prepPath = path.join(runBase, 'late-presence', 'preparation-manifest.json');
  const prep = readJson(prepPath);
  if (prep.schema !== LATE_PRESENCE_PREPARATION_SCHEMA) {
    throw new Error(`unexpected preparation schema: ${prep.schema}`);
  }
  const scorePath = path.join(runBase, 'late-presence', 'late-presence-score.json');
  refuseExisting(scorePath);
  for (const readerId of READER_IDS) refuseExisting(path.join(runBase, `${readerId}.assembled.json`));
  const ruling = readJson(RULING_003_PATH);
  if (
    ruling.ruling_id !== 'guarded-main-block-003' ||
    ruling.run_id !== path.basename(runBase) ||
    ruling.dropped_events.length !== ruling.expected_dropped_events
  ) {
    throw new Error('ruling 003 record does not match this run');
  }
  const ruling004 = readJson(RULING_004_PATH);
  if (
    ruling004.ruling_id !== 'guarded-main-block-004' ||
    ruling004.run_id !== path.basename(runBase) ||
    ruling004.quarantined_readings.length !== ruling004.expected_quarantined_readings
  ) {
    throw new Error('ruling 004 record does not match this run');
  }
  const retakePrepPath = path.join(runBase, 'late-presence', 'retakes', 'retake-preparation-manifest.json');
  const retakePrep = readJson(retakePrepPath);
  // CLAUDE.md (2026-08-21): ruling 004 is a JSON record in docs/ that is edited
  // in place, so its digest is written down. The ruling_id, run_id and
  // quarantined-reading count checks above still refuse on a real change.
  recordObservedDigest({
    label: 'ruling 004 record',
    filePath: path.relative(ROOT, RULING_004_PATH),
    recordedSha256: retakePrep.ruling.sha256,
    observedSha256: fileSha256(RULING_004_PATH),
  });
  return import(
    `file://${path.resolve(frozenCheckout, 'scripts/prepare-adaptive-warrant-semantic-annotations.js')}`
  ).then(async (preparer) => {
    const pilot = await import(
      `file://${path.resolve(frozenCheckout, 'scripts/run-adaptive-warrant-outcome-pilot.js')}`
    );
    const frozen = {
      assembleAdaptiveWarrantSemanticAnnotationResponse: preparer.assembleAdaptiveWarrantSemanticAnnotationResponse,
      writeOutcomePilotAssemblyRunView: pilot.writeOutcomePilotAssemblyRunView,
    };
    const retakes = loadRetakenReadings({ retakePrep, ruling: ruling004, frozen, runBase });
    if (retakes.substitutions.length !== ruling004.expected_quarantined_readings) {
      throw new Error(
        `ruling 004 expects ${ruling004.expected_quarantined_readings} retaken readings, ` +
          `found ${retakes.substitutions.length}`,
      );
    }
    const shardAssemblies = prep.shards.map((shard) =>
      assembleShard({ shard, frozen, runBase, ruling, substitutions: retakes.substitutions }),
    );
    const ruledDrops = shardAssemblies.flatMap((entry) => entry.ruledDrops);
    if (ruledDrops.length !== ruling.expected_dropped_events) {
      throw new Error(`ruling 003 expects ${ruling.expected_dropped_events} drops, applied ${ruledDrops.length}`);
    }
    const ruledSubs = shardAssemblies.flatMap((entry) => entry.ruledSubs);
    if (ruledSubs.length !== ruling004.expected_quarantined_readings) {
      throw new Error(
        `ruling 004 expects ${ruling004.expected_quarantined_readings} substitutions, applied ${ruledSubs.length}`,
      );
    }
    const merged = mergeAssemblies({ prep, shardAssemblies, runBase });
    const result = scoreGuardedPilotPrimaryEndpoint(runBase, { shape: GUARDED_MAIN_BLOCK_SHAPE });
    if (result.shape_problems.length) {
      throw new Error(`frozen scorer shape problems: ${result.shape_problems.join('; ')}`);
    }
    const rebase = readJson(path.join(runBase, 'evidence-move-rebase.json'));
    const score = {
      schema: LATE_PRESENCE_SCORE_SCHEMA,
      label: LATE_PRESENCE_LABEL,
      registration: 'docs/adaptation-refinement/relay/124-registration-late-presence-read.md',
      zero_model_calls_in_this_script: true,
      preparation_manifest: { path: prepPath, sha256: fileSha256(prepPath) },
      instrument_amendment_ruling_003: {
        ruling: { path: RULING_003_PATH, sha256: fileSha256(RULING_003_PATH), ruling_id: ruling.ruling_id },
        disclosure:
          'Three of 1,247 reader events failed the frozen assembler and were dropped under ' +
          'reviewer ruling 003 ("go with 2"). All three are the evidence-demand act in the ' +
          'holding-out band; none can reach the registered endpoint. For the three affected ' +
          'reader+shard pairs the assembler ran on derived response copies without its run ' +
          'record, after this script replicated that verification freely against the launcher ' +
          'run record and the original files.',
        dropped_events: ruledDrops,
      },
      instrument_amendment_ruling_004: {
        ruling: { path: RULING_004_PATH, sha256: fileSha256(RULING_004_PATH), ruling_id: ruling004.ruling_id },
        disclosure:
          'Ruling 003 undercounted the damage: its free probe was defective, and a corrected probe ' +
          'that replicates the frozen assembler exactly found 8 fatal events of 1,247, not 3. The 5 ' +
          'newly found (3 capitalization-only spans, 2 identical paraphrases; descriptive bands only, ' +
          'unable to reach the registered endpoint) were quarantined and retaken once each under ' +
          'reviewer ruling 004 (GO relay 126, 6 approved calls). Paid provenance of all six ' +
          'retake calls was verified by free replication of the launcher run-record checks; the five ' +
          'retaken case rows then replaced the quarantined rows in derived copies of the original ' +
          'responses, and the affected shard assemblies ran on those copies without the run record, ' +
          'after the same free replication. Every consumed retaken row therefore passed the FULL ' +
          'frozen validation (spans, catalog, ambiguity rules) inside its shard assembly. Two parts ' +
          'of the ruled mechanism could not run literally against the frozen tooling and are amended ' +
          'here, disclosed: (1) the frozen validator requires every shard assembly to cover its ' +
          'corpus exactly, so the ruled "omit the quarantined batches, slot the retaken case in at ' +
          'the merge" happens at the response row instead; (2) the forced extra reading ' +
          '(presence-reader-b on case-d9db44be3662bb53c7cfdad6, drawn only because the frozen ' +
          'preparer requires two readers, ruled stored/disclosed/unused) is itself assembly-invalid, ' +
          'so the retake collections cannot wholesale-assemble under the frozen assembler; the ' +
          'attempts are recorded per reader below. That reading is unused per ruling 004; the ' +
          'original valid reader-b reading of that case stands.',
        retake_preparation: { path: retakePrepPath, sha256: fileSha256(retakePrepPath) },
        retake_collections: retakes.collections,
        substitutions: ruledSubs,
        forced_extra_reading: ruling004.forced_extra_reading,
      },
      merged_assemblies: merged,
      endpoint: result,
      side_reports: {
        shadow_by_condition: shadowByCondition(result),
        agreement_with_relay_123: agreementWithRebase({ result, rebase }),
      },
    };
    fs.writeFileSync(scorePath, `${JSON.stringify(score, null, 2)}\n`);
    return { score, scorePath };
  });
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (invokedDirectly) {
  const { values } = parseArgs({
    options: {
      run: { type: 'string' },
      'frozen-checkout': { type: 'string', default: DEFAULT_FROZEN_CHECKOUT },
    },
  });
  if (!values.run) {
    process.stderr.write('usage: score-late-presence-read.js --run <run-dir> [--frozen-checkout <dir>]\n');
    process.exit(1);
  }
  scoreLatePresenceRead({ runDir: values.run, frozenCheckout: values['frozen-checkout'] })
    .then(({ score, scorePath }) => {
      const { contrast } = score.endpoint;
      process.stderr.write(
        `late presence read scored (${score.label})\n` +
          `delivered ${contrast.delivered.both_readers}/${contrast.delivered.moments} (${contrast.delivered.rate})` +
          ` vs shadow ${contrast.shadow.both_readers}/${contrast.shadow.moments} (${contrast.shadow.rate})` +
          ` — direction holds: ${contrast.direction_holds}\n${scorePath}\n`,
      );
    })
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    });
}
