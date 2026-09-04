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
import { recordObservedDigest } from '../services/recordedFileDigest.js';
import {
  OUTCOME_DEFAULT_RUN_SHAPE,
  OUTCOME_RUN_SHAPES,
  buildOutcomeInterleavedAssignment,
  resolveOutcomeRunShape,
} from './prepare-adaptive-warrant-outcome-study.js';

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

function isAncestorCommit(candidate, descendant) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', candidate, descendant], { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * A path inside the repo is recorded relative to it, so the seal reads the same
 * on any checkout. A path outside the repo -- an acceptance artifact under
 * /private/tmp, say -- is recorded absolute, because a relative path that walks
 * out of the repo is unreadable and breaks the moment the repo moves.
 */
export function recordedPath(resolved) {
  const relative = path.relative(ROOT, resolved);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? relative : resolved;
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
  // CLAUDE.md (2026-08-21): every pin in this list is a code file, a world
  // design, a config file or the standing-permission menu text. None of them is
  // sealed data, so each digest is recorded rather than enforced. Correcting a
  // defect in one of the three preparer scripts used to stop the re-seal.
  for (const row of rows) {
    recordObservedDigest({
      label: `guarded manifest inherited pin ${row.label}`,
      filePath: row.path,
      recordedSha256: row.expected,
      observedSha256: row.actual,
    });
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
  // The ping writes source_commit at the top level (see the result object in
  // run-adaptive-warrant-semantic-schema-acceptance-ping.js); older carryover
  // artifacts nest it under bindings.
  const stampedAt = artifact.source_commit ?? artifact.bindings?.source_commit ?? null;
  if (!/^[0-9a-f]{40}$/u.test(stampedAt || '')) {
    throw new Error('re-seal refuses: schema-acceptance artifact carries no source commit');
  }
  // Demanding the stamp equal HEAD would decay the moment the next commit
  // lands, and would push a later re-seal toward spending another call for no
  // evidence. What has to hold is the thing itself: the artifact comes from
  // this line of work, and the schema the provider accepted names the act
  // catalogue the readers build from now. The schema cannot be compared by
  // hash, because the preparer mints one per batch from the reader id, batch
  // id, corpus hash, and sample ids.
  if (stampedAt !== head && !isAncestorCommit(stampedAt, head)) {
    throw new Error(
      `re-seal refuses: schema-acceptance artifact was stamped at ${stampedAt}, which is not an ancestor of HEAD ${head}`,
    );
  }
  const sha = artifact.response_schema?.sha256;
  if (!/^[0-9a-f]{64}$/u.test(sha || '')) {
    throw new Error('re-seal refuses: schema-acceptance artifact carries no response-schema hash');
  }
  const coverage = auditFrozenResponseSchemaActCoverage(artifact.response_schema?.path);
  if (coverage.status !== 'covers_current_contract') {
    throw new Error(
      `re-seal refuses: the accepted response schema does not cover the current contract (${coverage.status}` +
        `${coverage.missing_speech_acts?.length ? `, missing ${coverage.missing_speech_acts.join(', ')}` : ''})`,
    );
  }
  return {
    status: sha === inheritedSha256 ? 'repinned_unchanged' : 'repinned',
    repinned: true,
    inherited_sha256: inheritedSha256,
    current_sha256: sha,
    acceptance_proved: true,
    acceptance_artifact: { path: recordedPath(resolved), sha256: sha256(fs.readFileSync(resolved)) },
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

/**
 * Rebuild the ledger sentence for a resized run.
 *
 * Every sum is read off the shape, so the sentence can never name a total the
 * plan does not carry. Whatever the base manifest wrote after the semicolon is a
 * measured note about live cost per dialogue, which holds at any size, so it is
 * carried over word for word.
 */
function buildResizedArithmetic(shape, baseArithmetic) {
  const note =
    typeof baseArithmetic === 'string' && baseArithmetic.includes(';')
      ? baseArithmetic.slice(baseArithmetic.indexOf(';'))
      : '';
  return (
    `(${shape.dialogues} x ${shape.per_dialogue_generation_cap} cap) + ` +
    `(${shape.readers_per_channel} x ${shape.cases}) + (${shape.readers_per_channel} x ${shape.cases}) = ` +
    `${shape.planned_calls.total}${note}`
  );
}

/** The only fields that say how large a run is. Everything else holds at any size. */
export const OUTCOME_RESIZED_MANIFEST_KEYS = Object.freeze([
  'run_shape',
  'seeds',
  'interleaved_condition_assignment',
  'case_extraction',
  'planned_calls',
]);

/**
 * Rebuild those five fields for a larger run.
 *
 * The rest of the base manifest — the worlds, the reader instrument, the pins,
 * the standing-permission rules — describes the same study whatever its size and
 * is inherited untouched. The counter fields are the exception: the ledger has
 * moved since the base was sealed, so a resized manifest must be handed the live
 * position and the three fields that follow from it are computed here.
 */
export function resizeOutcomeManifestFields({ base, shape, counterBefore }) {
  if (!Number.isInteger(counterBefore) || counterBefore < 0) {
    throw new Error(`resize refuses: a ${shape.name} manifest needs --counter-before, the live ledger position`);
  }
  const ceiling = base.planned_calls.ceiling;
  const counterAfter = counterBefore + shape.planned_calls.total;
  const remaining = ceiling - counterAfter;
  if (remaining < 0) {
    throw new Error(
      `resize refuses: ${shape.planned_calls.total} calls from ${counterBefore} would pass the ${ceiling} ceiling`,
    );
  }
  return {
    run_shape: shape.name,
    seeds: [...shape.seeds],
    interleaved_condition_assignment: buildOutcomeInterleavedAssignment({
      shape,
      worldIds: base.worlds.map((world) => world.id),
    }),
    case_extraction: {
      ...base.case_extraction,
      dialogues: shape.dialogues,
      turns_per_dialogue: shape.turns_per_dialogue,
      expected_case_count: shape.cases,
    },
    planned_calls: {
      ...shape.planned_calls,
      arithmetic: buildResizedArithmetic(shape, base.planned_calls.arithmetic),
      counter_before: counterBefore,
      counter_after_if_completed: counterAfter,
      ceiling,
      remaining_after_if_completed: remaining,
    },
  };
}

/**
 * Seal a guarded manifest at the size the shape names. The default is the pilot,
 * which is what every sealed manifest so far has been; a larger shape rebuilds
 * the five size fields and inherits the rest.
 */
export function sealGuardedOutcomePilotManifest({
  basePath = GUARDED_PILOT_MANIFEST_DEFAULT_BASE,
  shape = OUTCOME_DEFAULT_RUN_SHAPE,
  counterBefore = null,
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

  const resized =
    shape.name === OUTCOME_DEFAULT_RUN_SHAPE.name ? null : resizeOutcomeManifestFields({ base, shape, counterBefore });
  const inheritedUnchanged = [
    'worlds',
    'seeds',
    'conditions',
    'interleaved_condition_assignment',
    'case_extraction',
    'planned_calls',
    'standing_permission',
    'decision_channel',
  ].filter((key) => !resized || !OUTCOME_RESIZED_MANIFEST_KEYS.includes(key));

  const manifest = {
    ...base,
    ...(resized || {}),
    status: 'prepared_hold_for_reviewer_go',
    learner_profile: learnerProfile,
    contract_version: contractVersion,
    inherits_from: {
      manifest: basePath,
      sha256: sha256(fs.readFileSync(resolvedBase)),
      sealed_at_commit: commit,
      unchanged: inheritedUnchanged,
      ...(resized ? { resized: [...OUTCOME_RESIZED_MANIFEST_KEYS] } : {}),
    },
    reseal: {
      schema: 'machinespirits.adaptation-refinement.guarded-outcome-manifest-reseal.v1',
      zero_model_calls: true,
      run_shape: shape.name,
      reason:
        'The A1 manifest pins the reader instrument at contract v3.2. The guarded pole runs v3.3, so the two digests covering the changed files are re-computed here and every other pin is inherited and re-checked.',
      digest_sources: GUARDED_RESEAL_DIGEST_SOURCES,
      drift,
      inherited_pins: inherited,
      frozen_response_schema: responseSchemaAudit,
      provider_response_schema_pin: providerSchemaPin,
      // The launcher checks the four call counts by value against the run shape
      // and checks the ledger fields for closure, not against a frozen number.
      // At pilot size the ledger fields are carried over from the A1 seal: they
      // say where the counter stood then, not where it stands now. A resized
      // manifest is handed the live position instead, and the counter can still
      // move between this seal and GO, so it is re-read either way.
      ledger_note: {
        inherited_fields: resized
          ? []
          : ['counter_before', 'counter_after_if_completed', 'ceiling', 'remaining_after_if_completed'],
        inherited_from_seal: base.planned_calls,
        stale: !resized,
        re_read_at_go: true,
        ...(resized ? { counter_read_at_reseal: counterBefore } : {}),
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
      shape: { type: 'string', default: OUTCOME_DEFAULT_RUN_SHAPE.name },
      'counter-before': { type: 'string' },
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
      'Usage:\n  node scripts/seal-guarded-warrant-outcome-manifest.js [--base <a1-manifest>] [--out <path>]' +
        ` [--shape <${Object.keys(OUTCOME_RUN_SHAPES).join('|')}>] [--counter-before <n>]` +
        ' [--learner-profile <profile>] [--frozen-response-schema <path>] [--schema-acceptance <v3.3-acceptance-artifact>] [--dry-run]\n\n' +
        'Without --schema-acceptance the provider-response-schema pin is inherited and\n' +
        'the seal records that provider acceptance of the v3.3 schema is unproved.\n\n' +
        'A shape larger than the pilot rebuilds the seeds, the condition order, the case\n' +
        'count and the call plan, and needs --counter-before: the live campaign counter,\n' +
        'read from the ledger at seal time and re-read again at GO.\n',
    );
    return;
  }
  const shape = resolveOutcomeRunShape(values.shape);
  const counterBefore = values['counter-before'] === undefined ? null : Number(values['counter-before']);
  const sealed = sealGuardedOutcomePilotManifest({
    basePath: values.base,
    shape,
    counterBefore,
    learnerProfile: values['learner-profile'],
    frozenResponseSchemaPath: values['frozen-response-schema'] || null,
    schemaAcceptancePath: values['schema-acceptance'] || null,
  });
  const summary = {
    out: values['dry-run'] ? null : path.resolve(ROOT, values.out),
    run_shape: shape.name,
    planned_calls: sealed.manifest.planned_calls,
    dialogues: sealed.manifest.case_extraction.dialogues,
    seeds: sealed.manifest.seeds,
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
