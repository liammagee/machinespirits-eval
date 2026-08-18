#!/usr/bin/env node
/**
 * Ruling 004 dry preparation: retake collections for the 5 quarantined
 * readings of the late presence read.
 *
 * Zero model calls. One single-reader collection per shard-and-reader group,
 * each holding exactly the quarantined cases: the shard's own blinded corpus
 * filtered to those cases (same sample ids, same shard catalogue), the shard's
 * own freeze manifest with the one disclosed repoint (the corpus binding moves
 * to the filtered corpus), and packets built by the frozen preparer from the
 * parked checkout, unchanged. The GO note (relay 126) copies this
 * preparation's numbers.
 *
 * Usage:
 *   node scripts/prepare-late-presence-retake.js --run <run-dir> \
 *     [--frozen-checkout <dir>] [--handbook <file>]
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { PILOT_SEMANTIC_HANDBOOK_SHA256 } from './prepare-late-presence-read.js';

export const LATE_PRESENCE_RETAKE_PREPARATION_SCHEMA =
  'machinespirits.adaptation-refinement.late-presence-retake-preparation.v1';

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const DEFAULT_FROZEN_CHECKOUT = path.resolve(SCRIPT_DIR, '../../ms-guarded-readers-pinned');
const DEFAULT_HANDBOOK = path.resolve(
  SCRIPT_DIR,
  '../../machinespirits-eval-private/artifacts/adaptive-warrant-outcome-a1/seed-514-instrument-freeze/semantic-annotation-handbook.md',
);
export const RULING_004_PATH = path.resolve(
  SCRIPT_DIR,
  '../docs/adaptation-refinement/guarded-main-block/reviewer-ruling-004-quarantined-reading-retake.json',
);

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export async function prepareLatePresenceRetake({ runDir, frozenCheckout, handbookPath }) {
  const resolvedRun = path.resolve(runDir);
  const resolvedCheckout = path.resolve(frozenCheckout ?? DEFAULT_FROZEN_CHECKOUT);
  const resolvedHandbook = path.resolve(handbookPath ?? DEFAULT_HANDBOOK);
  const lateDir = path.join(resolvedRun, 'late-presence');
  const outDir = path.join(lateDir, 'retakes');
  const manifestPath = path.join(outDir, 'retake-preparation-manifest.json');
  if (fs.existsSync(manifestPath)) throw new Error(`refusing to overwrite existing file: ${manifestPath}`);

  const handbookSha = sha256(fs.readFileSync(resolvedHandbook));
  if (handbookSha !== PILOT_SEMANTIC_HANDBOOK_SHA256) {
    throw new Error(`handbook hash ${handbookSha} does not match the pilot's pinned handbook`);
  }

  const ruling = readJson(RULING_004_PATH);
  if (
    ruling.ruling_id !== 'guarded-main-block-004' ||
    ruling.run_id !== path.basename(resolvedRun) ||
    ruling.quarantined_readings.length !== ruling.expected_quarantined_readings
  ) {
    throw new Error('ruling 004 record does not match this run');
  }
  // The quarantined originals must still be the ruled bytes.
  for (const row of ruling.quarantined_readings) {
    const original = path.join(lateDir, row.shard, 'responses', row.reader, row.response_file);
    if (sha256(fs.readFileSync(original)) !== row.response_sha256) {
      throw new Error(`${row.shard}/${row.reader}/${row.response_file} does not match ruling 004's pinned hash`);
    }
  }

  const { prepareAdaptiveWarrantSemanticAnnotationBatches } = await import(
    `file://${path.join(resolvedCheckout, 'scripts/prepare-adaptive-warrant-semantic-annotations.js')}`
  );

  // The frozen preparer requires exactly two readers, so retakes group by
  // shard with both readers. Any drawn reading that is NOT quarantined is a
  // forced extra: stored, disclosed, unused (ruling 004 "forced_extra_reading").
  const READER_IDS = ['presence-reader-a', 'presence-reader-b'];
  const shardKeys = [...new Set(ruling.quarantined_readings.map((row) => row.shard))].sort();
  const groups = [];
  for (const shard of shardKeys) {
    const rows = ruling.quarantined_readings.filter((row) => row.shard === shard);
    const wanted = new Set(rows.map((row) => row.sample_id));
    const shardCorpus = readJson(path.join(lateDir, shard, 'corpus.blinded.json'));
    const cases = shardCorpus.cases.filter((row) => wanted.has(row.sample_id));
    if (cases.length !== wanted.size) {
      throw new Error(`${shard}: shard corpus holds ${cases.length} of ${wanted.size} quarantined cases`);
    }
    const groupDir = path.join(outDir, shard);
    fs.mkdirSync(groupDir, { recursive: true });
    const corpusPath = path.join(groupDir, 'corpus.blinded.json');
    fs.writeFileSync(corpusPath, `${JSON.stringify({ ...shardCorpus, cases }, null, 2)}\n`);

    // The shard freeze with the one disclosed repoint: its corpus binding.
    const shardFreeze = readJson(path.join(lateDir, shard, 'freeze-manifest.json'));
    const freeze = {
      ...shardFreeze,
      corpus: { path: corpusPath, sha256: sha256(fs.readFileSync(corpusPath)), cases: cases.length },
    };
    const freezePath = path.join(groupDir, 'freeze-manifest.json');
    fs.writeFileSync(freezePath, `${JSON.stringify(freeze, null, 2)}\n`);

    const collection = prepareAdaptiveWarrantSemanticAnnotationBatches({
      corpusPath,
      handbookPath: resolvedHandbook,
      outputDir: path.join(groupDir, 'collection'),
      corpusRole: 'natural_prevalence',
      readerIds: [...READER_IDS],
      batchSize: 1,
      maximumCalls: cases.length * READER_IDS.length,
      preflightPath: path.join(resolvedRun, 'semantic-brittleness-preflight.json'),
      schemaAcceptancePath: path.join(resolvedRun, 'semantic-schema-acceptance-carryover.json'),
    });
    const quarantinedPairs = rows.map((row) => `${row.reader}:${row.sample_id}`).sort();
    const forcedExtras = READER_IDS.flatMap((reader) => [...wanted].map((sampleId) => `${reader}:${sampleId}`))
      .filter((pair) => !quarantinedPairs.includes(pair))
      .sort();
    groups.push({
      group: shard,
      shard,
      readers: [...READER_IDS],
      sample_ids: [...wanted].sort(),
      cases: cases.length,
      quarantined_readings: quarantinedPairs,
      forced_extra_readings_stored_unused: forcedExtras,
      planned_calls: collection.authorizationRequest.call_budget.planned_calls,
      size_audit: collection.manifest.size_audit,
      collection_manifest: collection.manifestPath,
      authorization_request: collection.authorizationRequestPath,
      freeze_manifest: freezePath,
    });
  }

  const manifest = {
    schema: LATE_PRESENCE_RETAKE_PREPARATION_SCHEMA,
    ruling: { path: RULING_004_PATH, sha256: sha256(fs.readFileSync(RULING_004_PATH)) },
    zero_model_calls: true,
    run_dir: resolvedRun,
    frozen_checkout: resolvedCheckout,
    handbook: { path: resolvedHandbook, sha256: handbookSha },
    groups,
    planned_calls_total: groups.reduce((sum, group) => sum + group.planned_calls, 0),
    largest_packet_bytes: Math.max(...groups.map((group) => group.size_audit.largest_packet_bytes)),
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { manifest, manifestPath };
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (invokedDirectly) {
  const { values } = parseArgs({
    options: {
      run: { type: 'string' },
      'frozen-checkout': { type: 'string', default: DEFAULT_FROZEN_CHECKOUT },
      handbook: { type: 'string', default: DEFAULT_HANDBOOK },
    },
  });
  if (!values.run) {
    process.stderr.write(
      'usage: prepare-late-presence-retake.js --run <run-dir> [--frozen-checkout <dir>] [--handbook <file>]\n',
    );
    process.exit(2);
  }
  prepareLatePresenceRetake({
    runDir: values.run,
    frozenCheckout: values['frozen-checkout'],
    handbookPath: values.handbook,
  })
    .then(({ manifest, manifestPath }) => {
      for (const group of manifest.groups) {
        process.stderr.write(
          `${group.group}: ${group.cases} case(s), ${group.planned_calls} planned call(s), ` +
            `largest packet ${group.size_audit.largest_packet_bytes}\n`,
        );
      }
      process.stderr.write(
        `total planned calls: ${manifest.planned_calls_total}, largest packet ${manifest.largest_packet_bytes}\n${manifestPath}\n`,
      );
    })
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    });
}
