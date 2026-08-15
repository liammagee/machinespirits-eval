#!/usr/bin/env node

/**
 * Zero-call re-seal of the instrument freeze for the guarded (defensive)
 * learner pole at contract v3.3.
 *
 * Why this exists. The pilot launcher checks the manifest pin
 * `provider_response_schema_sha256` against the schema-acceptance artifact the
 * instrument freeze names (run-adaptive-warrant-outcome-pilot.js:250, and the
 * carry-over at :1224). Both sides were copies of the A1 seal, so the check
 * compared a number with itself and proved nothing. Re-pinning the manifest
 * from a v3.3 acceptance ping breaks that false agreement, which is the check
 * working: the freeze half has to move too, from the same evidence.
 *
 * So this script re-points exactly one field of the A1 freeze -- the
 * schema-acceptance binding -- at the v3.3 ping result, and refuses unless the
 * ping result and the guarded manifest agree on the response-schema hash. The
 * agreement is asserted across two files that were sealed from one paid call,
 * not carried over from one stale seal.
 *
 * It also copies the acceptance artifact and its response schema into the repo
 * and re-points the derived artifact at the copies. The A1 pair still lives in
 * /private/tmp, which is cleaned periodically; a launch that reads a deleted
 * schema fails for a reason that has nothing to do with the study.
 *
 * The script reads local files and writes three. It has no provider,
 * child-process, or model-call path.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { validateOutcomeFreezeFormForFrozenDecisionRunner } from './run-adaptive-warrant-outcome-pilot.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const GUARDED_FREEZE_DEFAULT_BASE =
  '/private/tmp/adaptive-warrant-v3-matrix-live-489f2429-r38-s514/annotation-freeze-manifest-r52-presence-confirmation.json';
export const GUARDED_FREEZE_DEFAULT_OUT = 'docs/adaptation-refinement/guarded-pilot/guarded-instrument-freeze.json';
export const GUARDED_FREEZE_DEFAULT_MANIFEST = 'docs/adaptation-refinement/guarded-pilot/guarded-pilot-manifest.json';
export const GUARDED_ACCEPTANCE_OUT = 'docs/adaptation-refinement/guarded-pilot/guarded-schema-acceptance-v33.json';
export const GUARDED_RESPONSE_SCHEMA_OUT = 'docs/adaptation-refinement/guarded-pilot/guarded-response-schema-v33.json';

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function fileSha256(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * The admissibility rules `carryOverOutcomeSchemaAcceptance` applies at launch,
 * checked here instead so a bad artifact is refused at seal time rather than
 * after a run has started.
 */
export function assertAcceptanceArtifactAdmissible(artifact) {
  const failures = [];
  if (artifact.status !== 'passed') failures.push(`status ${artifact.status}`);
  if (artifact.inferential_role !== 'transport_only_permanently_excluded') failures.push('inferential_role');
  if (artifact.synthetic_case_permanently_excluded !== true) failures.push('synthetic_case_permanently_excluded');
  if (artifact.response_received !== true) failures.push('response_received');
  if (artifact.calls?.attempted !== 1 || artifact.calls?.completed !== 1 || artifact.calls?.maximum !== 1) {
    failures.push('calls not 1/1/1');
  }
  if (artifact.prohibited_tool_event_count !== 0) failures.push('prohibited_tool_event_count');
  if (!/^[0-9a-f]{40}$/u.test(artifact.source_commit || '')) failures.push('source_commit');
  if (!/^[0-9a-f]{64}$/u.test(artifact.response_schema?.sha256 || '')) failures.push('response_schema.sha256');
  if (!artifact.response_schema?.path || !fs.existsSync(artifact.response_schema.path)) {
    failures.push('response_schema.path missing on disk');
  } else if (fileSha256(artifact.response_schema.path) !== artifact.response_schema.sha256) {
    failures.push('response_schema.path no longer hashes to its recorded value');
  }
  if (failures.length) {
    throw new Error(`freeze re-seal refuses the acceptance artifact: ${failures.join(', ')}`);
  }
  return { status: 'passed' };
}

/**
 * Refuse unless the manifest pin and the acceptance artifact agree. This is the
 * whole point of the re-seal: after it, the launcher's provider-schema check
 * compares two files that were sealed from one paid call, and a drift in either
 * one stops the run.
 */
export function assertManifestPinAgrees({ manifest, acceptance }) {
  const pinned = manifest?.presence_channel?.digests?.provider_response_schema_sha256;
  const proved = acceptance?.response_schema?.sha256;
  if (pinned !== proved) {
    throw new Error(
      `freeze re-seal refuses: the guarded manifest pins ${pinned || '(nothing)'} and the acceptance artifact proves ${proved || '(nothing)'}; ` +
        're-seal the manifest from this artifact first',
    );
  }
  return { status: 'passed', sha256: pinned };
}

export function sealGuardedInstrumentFreeze({
  basePath = GUARDED_FREEZE_DEFAULT_BASE,
  acceptancePath,
  manifestPath = GUARDED_FREEZE_DEFAULT_MANIFEST,
  acceptanceOut = GUARDED_ACCEPTANCE_OUT,
  responseSchemaOut = GUARDED_RESPONSE_SCHEMA_OUT,
} = {}) {
  if (!acceptancePath) throw new Error('freeze re-seal requires --schema-acceptance <v3.3 ping result>');
  const resolvedBase = path.resolve(ROOT, basePath);
  const base = readJson(resolvedBase);
  validateOutcomeFreezeFormForFrozenDecisionRunner(base);
  for (const field of ['protocol', 'corpus', 'annotation_handbook', 'key', 'study_plan']) {
    const binding = base[field];
    if (!fs.existsSync(binding.path) || fileSha256(binding.path) !== binding.sha256) {
      throw new Error(`freeze re-seal refuses: inherited binding ${field} no longer hashes at ${binding.path}`);
    }
  }

  const source = readJson(path.resolve(ROOT, acceptancePath));
  assertAcceptanceArtifactAdmissible(source);
  const pinAgreement = assertManifestPinAgrees({
    manifest: readJson(path.resolve(ROOT, manifestPath)),
    acceptance: source,
  });

  // Copy the schema into the repo and point the derived artifact at the copy,
  // so a /private/tmp clean cannot break a launch. Same bytes, same hash.
  const resolvedSchemaOut = path.resolve(ROOT, responseSchemaOut);
  const schemaBytes = fs.readFileSync(source.response_schema.path);
  if (sha256(schemaBytes) !== source.response_schema.sha256) {
    throw new Error('freeze re-seal refuses: the response schema changed while it was being read');
  }

  const acceptance = {
    ...source,
    response_schema: { ...source.response_schema, path: resolvedSchemaOut },
    derived_from: {
      schema: 'machinespirits.adaptation-refinement.guarded-acceptance-repoint.v1',
      reason:
        'Only response_schema.path is re-pointed, from /private/tmp to a copy inside the repo. The bytes and the hash are unchanged.',
      original_result: {
        path: path.resolve(ROOT, acceptancePath),
        sha256: fileSha256(path.resolve(ROOT, acceptancePath)),
      },
      original_response_schema_path: source.response_schema.path,
    },
  };

  const freeze = {
    ...base,
    semantic_instrument: {
      ...base.semantic_instrument,
      schema_acceptance: { path: path.resolve(ROOT, acceptanceOut), sha256: null },
    },
    guarded_reseal: {
      schema: 'machinespirits.adaptation-refinement.guarded-instrument-freeze-reseal.v1',
      zero_model_calls: true,
      contract_version: 'v3.3',
      reason:
        'The A1 freeze names a schema-acceptance artifact minted before v3.3. The guarded manifest is re-pinned from a v3.3 acceptance ping, so the freeze is re-pointed at the same artifact. Every other field is inherited unchanged.',
      inherits_from: { freeze: resolvedBase, sha256: fileSha256(resolvedBase), source_commit: base.source_commit },
      replaced_binding: {
        field: 'semantic_instrument.schema_acceptance',
        was: base.semantic_instrument.schema_acceptance,
      },
      provider_response_schema_sha256: pinAgreement.sha256,
      acceptance_source_commit: source.source_commit,
    },
  };

  return { freeze, acceptance, schemaBytes, base, source, pinAgreement, resolvedSchemaOut };
}

function main() {
  const { values } = parseArgs({
    options: {
      base: { type: 'string', default: GUARDED_FREEZE_DEFAULT_BASE },
      'schema-acceptance': { type: 'string' },
      manifest: { type: 'string', default: GUARDED_FREEZE_DEFAULT_MANIFEST },
      out: { type: 'string', default: GUARDED_FREEZE_DEFAULT_OUT },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  });
  if (values.help) {
    process.stdout.write(
      'Usage:\n  node scripts/seal-guarded-warrant-instrument-freeze.js --schema-acceptance <v3.3 ping result> [--base <a1-freeze>] [--manifest <guarded-manifest>] [--out <path>] [--dry-run]\n\nRefuses unless the guarded manifest pin and the acceptance artifact agree on\nthe response-schema hash.\n',
    );
    return;
  }
  const sealed = sealGuardedInstrumentFreeze({
    basePath: values.base,
    acceptancePath: values['schema-acceptance'],
    manifestPath: values.manifest,
  });
  const acceptanceOut = path.resolve(ROOT, GUARDED_ACCEPTANCE_OUT);
  const freezeOut = path.resolve(ROOT, values.out);
  if (!values['dry-run']) {
    fs.mkdirSync(path.dirname(freezeOut), { recursive: true });
    fs.writeFileSync(sealed.resolvedSchemaOut, sealed.schemaBytes);
    fs.writeFileSync(acceptanceOut, `${JSON.stringify(sealed.acceptance, null, 2)}\n`);
    // The freeze binds the acceptance artifact by hash, so the hash is taken
    // after the artifact is on disk in its final form.
    sealed.freeze.semantic_instrument.schema_acceptance.sha256 = fileSha256(acceptanceOut);
    fs.writeFileSync(freezeOut, `${JSON.stringify(sealed.freeze, null, 2)}\n`);
  }
  process.stdout.write(
    `${JSON.stringify(
      {
        freeze: values['dry-run'] ? null : freezeOut,
        acceptance: values['dry-run'] ? null : acceptanceOut,
        response_schema: values['dry-run'] ? null : sealed.resolvedSchemaOut,
        inherited_freeze_commit: sealed.base.source_commit,
        acceptance_source_commit: sealed.source.source_commit,
        provider_response_schema_sha256: sealed.pinAgreement.sha256,
        manifest_pin_agrees: true,
      },
      null,
      2,
    )}\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`[guarded-freeze-reseal] ${error.message}`);
    process.exitCode = 1;
  }
}
