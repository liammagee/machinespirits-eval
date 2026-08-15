#!/usr/bin/env node

/**
 * Zero-call re-seal of the warrant outcome pilot manifest for the guarded
 * (defensive) learner pole at contract v3.3.
 *
 * The A1 pilot manifest pins the reader instrument by bytes. Two of those pins
 * no longer match, for two different reasons, and this script refuses to treat
 * them the same way:
 *
 *   - the extraction-schema digest moved because v3.3 added three defensive
 *     speech acts to the file the digest covers. That is the study, so the
 *     re-pin has to be named on the command line;
 *   - the reader digest moved because a formatting pass reflowed three files
 *     after the A1 manifest was written. Nothing about the program changed.
 *
 * So every file behind a re-pinned digest is parsed at the sealed commit and at
 * the working tree, and the two parse trees are compared with positions
 * removed. A file whose tree is unchanged is a reflow and may be re-pinned. A
 * file whose tree changed may only be re-pinned when it is passed as an
 * explicit contract change. Anything else fails the seal.
 *
 * The script reads local source and git blobs and writes one manifest. It has
 * no provider, child-process, or model-call path.
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { parse } from 'acorn';

import {
  ADAPTIVE_WARRANT_SEMANTIC_DEFENSIVE_SPEECH_ACTS,
  ADAPTIVE_WARRANT_SEMANTIC_SPEECH_ACTS,
} from '../services/adaptiveWarrantSemanticEvents.js';
import { adaptiveWarrantSemanticInstrumentBindings } from '../services/adaptiveWarrantSemanticPreflight.js';
import { OUTCOME_STUDY_SUPPORTED_LEARNER_PROFILES } from '../services/adaptiveWarrantOutcomeLearnerProfiles.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const GUARDED_PILOT_MANIFEST_DEFAULT_BASE = 'docs/adaptation-refinement/outcome-study-a1/pilot-manifest.json';
export const GUARDED_PILOT_MANIFEST_DEFAULT_OUT =
  'docs/adaptation-refinement/guarded-pilot/guarded-pilot-manifest.json';

// The file behind each digest the re-seal is allowed to move. Everything else
// in the manifest is inherited and must still hash-match the working tree.
export const GUARDED_RESEAL_DIGEST_SOURCES = Object.freeze({
  extraction_schema_digest: Object.freeze(['services/adaptiveWarrantSemanticEvents.js']),
  reader_digest: Object.freeze([
    'services/adaptiveWarrantSemanticAnnotation.js',
    'scripts/prepare-adaptive-warrant-semantic-annotations.js',
    'scripts/run-adaptive-warrant-semantic-schema-acceptance-ping.js',
  ]),
});

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, maxBuffer: 1024 * 1024 * 256 });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function strippedTree(node) {
  if (Array.isArray(node)) return node.map(strippedTree);
  if (!node || typeof node !== 'object') return node;
  const out = {};
  for (const key of Object.keys(node).sort()) {
    if (key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue;
    out[key] = strippedTree(node[key]);
  }
  return out;
}

function programFingerprint(source) {
  return sha256(JSON.stringify(strippedTree(parse(source, { ecmaVersion: 'latest', sourceType: 'module' }))));
}

/**
 * Classify one file's drift between the sealed commit and the working tree.
 * `reflow_only` means the bytes moved and the program did not.
 */
export function classifyGuardedResealDrift({ relativePath, sealedCommit }) {
  const sealedBytes = git(['show', `${sealedCommit}:${relativePath}`]);
  const currentBytes = fs.readFileSync(path.join(ROOT, relativePath));
  const sealedSha = sha256(sealedBytes);
  const currentSha = sha256(currentBytes);
  if (sealedSha === currentSha) {
    return { path: relativePath, drift: 'none', sealed_sha256: sealedSha, current_sha256: currentSha };
  }
  const sameProgram =
    programFingerprint(sealedBytes.toString('utf8')) === programFingerprint(currentBytes.toString('utf8'));
  return {
    path: relativePath,
    drift: sameProgram ? 'reflow_only' : 'program_changed',
    sealed_sha256: sealedSha,
    current_sha256: currentSha,
  };
}

/**
 * The frozen presence readers answer under a response schema minted before
 * v3.3. Report which acts that schema cannot name, rather than inheriting the
 * pin as if it covered them.
 */
export function auditFrozenResponseSchemaActCoverage(responseSchemaPath) {
  if (!responseSchemaPath || !fs.existsSync(responseSchemaPath)) {
    return { status: 'unresolved', path: responseSchemaPath || null, missing_speech_acts: null };
  }
  const text = fs.readFileSync(responseSchemaPath, 'utf8');
  const missing = ADAPTIVE_WARRANT_SEMANTIC_SPEECH_ACTS.filter((act) => !text.includes(act));
  return {
    status: missing.length === 0 ? 'covers_current_contract' : 'predates_current_contract',
    path: responseSchemaPath,
    sha256: sha256(fs.readFileSync(responseSchemaPath)),
    current_speech_act_count: ADAPTIVE_WARRANT_SEMANTIC_SPEECH_ACTS.length,
    missing_speech_acts: missing,
    defensive_speech_acts_missing: missing.filter((act) =>
      ADAPTIVE_WARRANT_SEMANTIC_DEFENSIVE_SPEECH_ACTS.includes(act),
    ),
  };
}

function verifyInheritedPins(base) {
  const standing = base.standing_permission || {};
  const pins = [
    [standing.menu_json, standing.menu_json_sha256, 'menu JSON'],
    [standing.menu_text, standing.menu_text_sha256, 'menu text'],
    ...Object.entries(standing.source_sha256 || {}).map(([file, digest]) => [file, digest, `source pin ${file}`]),
    ...(base.worlds || []).map((world) => [world.path, world.sha256, `world ${world.id}`]),
    [
      'scripts/prepare-adaptive-warrant-semantic-annotations.js',
      base.presence_channel.digests.preparer_sha256,
      'presence preparer',
    ],
    [
      'scripts/prepare-adaptive-warrant-annotation-batches.js',
      base.decision_channel.digests.preparation_and_assembly_sha256,
      'decision preparer',
    ],
    [
      'scripts/run-adaptive-warrant-decision-readers.js',
      base.decision_channel.digests.reader_runner_sha256,
      'decision runner',
    ],
  ];
  const rows = pins.map(([file, expected, label]) => {
    const resolved = path.resolve(ROOT, file);
    const present = fs.existsSync(resolved);
    return { label, path: file, expected, actual: present ? sha256(fs.readFileSync(resolved)) : null };
  });
  const failed = rows.filter((row) => row.actual !== row.expected);
  if (failed.length) {
    throw new Error(`inherited pin no longer matches: ${failed.map((row) => row.label).join(', ')}`);
  }
  return rows.map(({ label, path: file, expected }) => ({ label, path: file, sha256: expected }));
}

/**
 * The launcher checks `provider_response_schema_sha256` against the carried-over
 * acceptance artifact, and nothing else. Both sides are the A1 value, so the
 * check passes on stale bytes. It proves nothing, because the readers are not
 * sent that schema: `prepare-adaptive-warrant-semantic-annotations.js` builds a
 * response schema from the live act catalogue for every batch, and at v3.3 that
 * catalogue is three acts larger than the schema the acceptance ping tested.
 *
 * So the pin may be re-pinned only from a fresh acceptance artifact stamped at
 * the current commit. With no artifact the pin is inherited and the seal says
 * plainly that provider acceptance of the v3.3 schema is unproved.
 */
export function auditProviderResponseSchemaPin({ acceptancePath = null, inheritedSha256 = null } = {}) {
  if (!acceptancePath) {
    return {
      status: 'inherited_unproved',
      repinned: false,
      inherited_sha256: inheritedSha256,
      readers_answer_under: 'a response schema built from the live act catalogue at run time',
      acceptance_proved: false,
      note: 'The pinned acceptance covers the pre-v3.3 schema. Run the schema-acceptance ping at v3.3 and re-seal with --schema-acceptance to prove the provider takes the larger schema.',
    };
  }
  const resolved = path.resolve(ROOT, acceptancePath);
  const artifact = readJson(resolved);
  const head = git(['rev-parse', 'HEAD']).toString('utf8').trim();
  if (artifact.status !== 'passed') {
    throw new Error(`re-seal refuses: schema-acceptance artifact did not pass (${artifact.status})`);
  }
  if (artifact.bindings?.source_commit !== head) {
    throw new Error('re-seal refuses: schema-acceptance artifact was not stamped at the current commit');
  }
  const sha = artifact.response_schema?.sha256;
  if (!/^[0-9a-f]{64}$/u.test(sha || '')) {
    throw new Error('re-seal refuses: schema-acceptance artifact carries no response-schema hash');
  }
  return {
    status: sha === inheritedSha256 ? 'repinned_unchanged' : 'repinned',
    repinned: true,
    inherited_sha256: inheritedSha256,
    current_sha256: sha,
    acceptance_proved: true,
    acceptance_artifact: { path: path.relative(ROOT, resolved), sha256: sha256(fs.readFileSync(resolved)) },
  };
}

/**
 * A re-seal that omits --frozen-response-schema would quietly write "unresolved"
 * over a status an earlier run actually read from the artifact. That turns a
 * recorded finding into a blank, which is the same class of defect as a stale
 * pin. Refuse, and name the flag to re-supply.
 */
export function refuseFrozenSchemaAuditDowngrade({ outPath, audit }) {
  const resolved = path.resolve(ROOT, outPath);
  if (!fs.existsSync(resolved)) return;
  const previous = readJson(resolved)?.reseal?.frozen_response_schema;
  if (!previous || previous.status === 'unresolved') return;
  if (audit.status !== 'unresolved') return;
  throw new Error(
    `re-seal refuses: the existing seal read the frozen response schema as "${previous.status}" from ${previous.path}; ` +
      're-supply --frozen-response-schema <path> rather than write "unresolved" over it',
  );
}

export function sealGuardedOutcomePilotManifest({
  basePath = GUARDED_PILOT_MANIFEST_DEFAULT_BASE,
  learnerProfile = 'overconfident',
  contractVersion = 'v3.3',
  contractChangedFiles = ['services/adaptiveWarrantSemanticEvents.js'],
  frozenResponseSchemaPath = null,
  schemaAcceptancePath = null,
  sealedCommit = null,
} = {}) {
  if (!OUTCOME_STUDY_SUPPORTED_LEARNER_PROFILES.includes(learnerProfile)) {
    throw new Error(`unsupported outcome-study learner profile: ${learnerProfile}`);
  }
  const resolvedBase = path.resolve(ROOT, basePath);
  const base = readJson(resolvedBase);
  const commit = sealedCommit || git(['log', '-1', '--format=%H', '--', basePath]).toString('utf8').trim();
  if (!/^[0-9a-f]{40}$/u.test(commit)) throw new Error('could not resolve the commit that sealed the base manifest');

  const inherited = verifyInheritedPins(base);
  const bindings = adaptiveWarrantSemanticInstrumentBindings({
    sourceCommit: git(['rev-parse', 'HEAD']).toString('utf8').trim(),
  });
  const recomputed = {
    extraction_schema_digest: bindings.extraction_schema.digest,
    reader_digest: bindings.reader_schema_digest,
  };

  const drift = [];
  for (const [digestName, sources] of Object.entries(GUARDED_RESEAL_DIGEST_SOURCES)) {
    for (const relativePath of sources) {
      const row = classifyGuardedResealDrift({ relativePath, sealedCommit: commit });
      if (row.drift === 'program_changed' && !contractChangedFiles.includes(relativePath)) {
        throw new Error(`re-seal refuses: ${relativePath} changed as a program and was not declared a contract change`);
      }
      drift.push({ digest: digestName, ...row, declared_contract_change: contractChangedFiles.includes(relativePath) });
    }
  }
  const unusedDeclarations = contractChangedFiles.filter(
    (file) => !drift.some((row) => row.path === file && row.drift === 'program_changed'),
  );
  if (unusedDeclarations.length) {
    throw new Error(`re-seal refuses: declared contract change did not change: ${unusedDeclarations.join(', ')}`);
  }

  const responseSchemaAudit = auditFrozenResponseSchemaActCoverage(frozenResponseSchemaPath);
  const providerSchemaPin = auditProviderResponseSchemaPin({
    acceptancePath: schemaAcceptancePath,
    inheritedSha256: base.presence_channel.digests.provider_response_schema_sha256,
  });
  if (providerSchemaPin.repinned) {
    recomputed.provider_response_schema_sha256 = providerSchemaPin.current_sha256;
  }

  const manifest = {
    ...base,
    status: 'prepared_hold_for_reviewer_go',
    learner_profile: learnerProfile,
    contract_version: contractVersion,
    inherits_from: {
      manifest: basePath,
      sha256: sha256(fs.readFileSync(resolvedBase)),
      sealed_at_commit: commit,
      unchanged: [
        'worlds',
        'seeds',
        'conditions',
        'interleaved_condition_assignment',
        'case_extraction',
        'planned_calls',
        'standing_permission',
        'decision_channel',
      ],
    },
    reseal: {
      schema: 'machinespirits.adaptation-refinement.guarded-outcome-manifest-reseal.v1',
      zero_model_calls: true,
      reason:
        'The A1 manifest pins the reader instrument at contract v3.2. The guarded pole runs v3.3, so the two digests covering the changed files are re-computed here and every other pin is inherited and re-checked.',
      digest_sources: GUARDED_RESEAL_DIGEST_SOURCES,
      drift,
      inherited_pins: inherited,
      frozen_response_schema: responseSchemaAudit,
      provider_response_schema_pin: providerSchemaPin,
      // The launcher asserts planned_calls by value against a frozen literal,
      // so the four ledger fields inside it are carried over unchanged. They
      // record where the counter stood when A1 was sealed, not where it stands
      // for this pilot, and the live position must be re-read at GO time.
      ledger_note: {
        inherited_fields: ['counter_before', 'counter_after_if_completed', 'ceiling', 'remaining_after_if_completed'],
        inherited_from_seal: base.planned_calls,
        stale: true,
        re_read_at_go: true,
      },
    },
    presence_channel: {
      ...base.presence_channel,
      digests: { ...base.presence_channel.digests, ...recomputed },
    },
    launch_authorized: false,
    hold: 'No model or reader call may run until an approved GO note for the guarded pilot is committed.',
  };
  return { manifest, base, sealedCommit: commit, drift, responseSchemaAudit, providerSchemaPin };
}

function main() {
  const { values } = parseArgs({
    options: {
      base: { type: 'string', default: GUARDED_PILOT_MANIFEST_DEFAULT_BASE },
      out: { type: 'string', default: GUARDED_PILOT_MANIFEST_DEFAULT_OUT },
      'learner-profile': { type: 'string', default: 'overconfident' },
      'frozen-response-schema': { type: 'string' },
      'schema-acceptance': { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  });
  if (values.help) {
    process.stdout.write(
      'Usage:\n  node scripts/seal-guarded-warrant-outcome-manifest.js [--base <a1-manifest>] [--out <path>] [--learner-profile <profile>] [--frozen-response-schema <path>] [--schema-acceptance <v3.3-acceptance-artifact>] [--dry-run]\n\nWithout --schema-acceptance the provider-response-schema pin is inherited and\nthe seal records that provider acceptance of the v3.3 schema is unproved.\n',
    );
    return;
  }
  const sealed = sealGuardedOutcomePilotManifest({
    basePath: values.base,
    learnerProfile: values['learner-profile'],
    frozenResponseSchemaPath: values['frozen-response-schema'] || null,
    schemaAcceptancePath: values['schema-acceptance'] || null,
  });
  const summary = {
    out: values['dry-run'] ? null : path.resolve(ROOT, values.out),
    sealed_base_commit: sealed.sealedCommit,
    drift: sealed.drift.map((row) => `${row.path}: ${row.drift}`),
    frozen_response_schema: sealed.responseSchemaAudit.status,
    missing_speech_acts: sealed.responseSchemaAudit.missing_speech_acts,
    provider_response_schema_pin: sealed.providerSchemaPin.status,
  };
  if (!values['dry-run']) {
    const resolved = path.resolve(ROOT, values.out);
    refuseFrozenSchemaAuditDowngrade({ outPath: resolved, audit: sealed.responseSchemaAudit });
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, `${JSON.stringify(sealed.manifest, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`[guarded-reseal] ${error.message}`);
    process.exitCode = 1;
  }
}
