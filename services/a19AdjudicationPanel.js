/**
 * a19AdjudicationPanel.js — server-side panel operations for A19 human coding.
 *
 * The offline artifact chain (packet → blinded assignment + private key →
 * coder files → merge/report) already enforces blinding at generation time.
 * This service is the missing *serving-time* enforcement layer, so the
 * dashboard can host real coders instead of a single localhost researcher:
 *
 *   - roster        — per-coder access keys mapped to assigned packet slugs.
 *                     The roster file is PRIVATE (it holds the keys) and lives
 *                     under exports/ (git-ignored). Managed by
 *                     scripts/manage-a19-adjudication-roster.js.
 *   - sanitization  — assignments are projected onto an explicit public-field
 *                     allowlist and screened with the validator's
 *                     FORBIDDEN_PRIVATE_MARKERS before they leave the server.
 *                     A leaky assignment is REFUSED, never served.
 *   - drafts        — per-coder resume state stored next to submissions in a
 *                     `.drafts/` subdirectory (invisible to the merge script's
 *                     `*.json` glob), written atomically.
 *   - completeness  — packets × coders matrix scored against the agreement
 *                     plan in config/teaching-drama-axioms/a19-adjudication-panel.yaml
 *                     (minimum_coders_for_claim / high_value_claim_target_coders).
 *
 * Two modes, resolved per request by the routes:
 *   open  — no roster file. The localhost research flow: every discovered
 *           assignment is visible, coder identity is self-asserted. This is
 *           the pre-existing behaviour, kept for dev and for the CLI parity.
 *   keyed — roster file present. Coder identity comes ONLY from the access
 *           key; a coder sees and touches only their assigned packets.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { validateA19HumanCoderFile, FORBIDDEN_PRIVATE_MARKERS } from '../scripts/validate-a19-human-coder-file.js';
import {
  buildCoderSubmission,
  defaultSubmissionDirForAssignment,
  nextCoderId,
} from '../scripts/run-a19-human-adjudication-cli.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const DEFAULT_ASSIGNMENT = path.join(
  ROOT,
  'exports',
  'a19',
  'human-coder-assignments',
  'moral-disclosure-standing-repair-a.assignment.json',
);
const DEFAULT_CODEBOOK = path.join(
  ROOT,
  'exports',
  'a19',
  'adjudication-codebooks',
  'learner-standing-v01.codebook.json',
);
const DEFAULT_SUBMISSIONS_ROOT = path.join(ROOT, 'exports', 'a19', 'human-coder-submissions');
const DEFAULT_ROSTER = path.join(ROOT, 'exports', 'a19', 'adjudication-roster.json');
const DEFAULT_PANEL_CONFIG = path.join(ROOT, 'config', 'teaching-drama-axioms', 'a19-adjudication-panel.yaml');

export const ROSTER_SCHEMA_VERSION = 'a19-adjudication-roster-v01';
export const DRAFT_SCHEMA_VERSION = 'a19-adjudication-draft-v01';
const MIN_ACCESS_KEY_LENGTH = 16;
const MAX_DRAFT_BYTES = 256 * 1024;

/**
 * Public projection of an assignment. Anything not listed here is dropped
 * before serving; private-key material must never even be generated into the
 * assignment file, but serving-time enforcement does not trust that.
 */
const PUBLIC_ASSIGNMENT_FIELDS = [
  'schema_version',
  'assignment_id',
  'packet_id',
  'packet_run_id',
  'packet_sha256',
  'codebook_id',
  'codebook_path',
  'created_at',
  'claim_boundary',
  'arms',
  'coder_task',
  'coder_instructions',
  'response_schema',
  'assignment_audit',
  'non_claims',
];
const PUBLIC_ARM_FIELDS = ['arm_public_id', 'transcript', 'transcript_sha256', 'visible_alias_audit'];

/**
 * Key names that mark assignment-KEY material. Their presence anywhere in an
 * assignment file means the blinded/private split failed upstream — refuse to
 * serve rather than projecting around it.
 */
const PRIVATE_FIELD_NAMES = new Set([
  'arm_map',
  'private_answer_key',
  'private_packet_mapping',
  'withheld_from_coder',
  'private_key',
  'source_arm_id',
]);

export class A19PanelError extends Error {
  constructor(message, { status = 400, code = 'a19_panel_error', details = null } = {}) {
    super(message);
    this.name = 'A19PanelError';
    this.httpStatus = status;
    this.code = code;
    if (details) this.details = details;
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`,
  );
  fs.writeFileSync(tmpPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

export function repoRel(filePath) {
  return path.relative(ROOT, path.resolve(filePath));
}

// Constant-time string equality (same shape as httpBasicAuth's internal
// helper; kept local so the panel service does not reach into auth internals).
function safeEqual(a, b) {
  const ab = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (ab.length !== bb.length) {
    crypto.timingSafeEqual(ab, ab);
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}

export function safeCoderId(value) {
  const coderId = String(value || '')
    .trim()
    .replace(/[^\w-]/gu, '');
  if (!coderId) throw new A19PanelError('coder_id is required', { status: 400, code: 'coder_id_required' });
  if (coderId.length > 80) throw new A19PanelError('coder_id is too long', { status: 400, code: 'coder_id_too_long' });
  return coderId;
}

export function safeSlug(value) {
  const slug = String(value || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(slug) || slug.includes('..')) {
    throw new A19PanelError(`invalid assignment slug: ${value}`, { status: 400, code: 'invalid_slug' });
  }
  return slug;
}

export function assignmentSlug(assignmentPath) {
  const base = path.basename(assignmentPath);
  return base.endsWith('.assignment.json') ? base.replace(/\.assignment\.json$/u, '') : base.replace(/\.json$/u, '');
}

/**
 * Resolve every path the panel works with, from env overrides down to repo
 * defaults. Pure function of `env` so tests can construct isolated workspaces.
 */
export function resolveWorkspace(env = process.env) {
  const legacyAssignmentPath = path.resolve(env.A19_ADJUDICATION_ASSIGNMENT || DEFAULT_ASSIGNMENT);
  const assignmentsDir = path.resolve(env.A19_ADJUDICATION_ASSIGNMENTS_DIR || path.dirname(legacyAssignmentPath));
  return {
    assignmentsDir,
    legacyAssignmentPath,
    codebookOverridePath: env.A19_ADJUDICATION_CODEBOOK ? path.resolve(env.A19_ADJUDICATION_CODEBOOK) : null,
    submissionsRoot: path.resolve(env.A19_ADJUDICATION_SUBMISSIONS_ROOT || DEFAULT_SUBMISSIONS_ROOT),
    legacyOutDir: env.A19_ADJUDICATION_OUT_DIR ? path.resolve(env.A19_ADJUDICATION_OUT_DIR) : null,
    rosterPath: path.resolve(env.A19_ADJUDICATION_ROSTER || DEFAULT_ROSTER),
    panelConfigPath: path.resolve(env.A19_ADJUDICATION_PANEL_CONFIG || DEFAULT_PANEL_CONFIG),
  };
}

/**
 * Submission directory for one assignment slug. Honors the legacy
 * A19_ADJUDICATION_OUT_DIR override for the single legacy assignment (the
 * pre-roster server served exactly one assignment into exactly that dir);
 * every other slug gets <submissionsRoot>/<slug>/.
 */
export function submissionDirForSlug(workspace, slug) {
  if (workspace.legacyOutDir && slug === assignmentSlug(workspace.legacyAssignmentPath)) {
    return workspace.legacyOutDir;
  }
  if (!workspace.legacyOutDir && slug === assignmentSlug(workspace.legacyAssignmentPath)) {
    // Match the CLI's default for the legacy assignment so server and CLI
    // submissions land in the same place.
    return defaultSubmissionDirForAssignment(workspace.legacyAssignmentPath);
  }
  return path.join(workspace.submissionsRoot, slug);
}

export function resolveCodebookPath(workspace, assignment) {
  if (workspace.codebookOverridePath) return workspace.codebookOverridePath;
  if (assignment?.codebook_path) {
    const candidate = path.resolve(ROOT, assignment.codebook_path);
    if (fs.existsSync(candidate)) return candidate;
  }
  return DEFAULT_CODEBOOK;
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

/**
 * Load and validate the roster. Returns null when no roster file exists (open
 * mode). Throws loudly on a malformed roster — a half-trusted roster is worse
 * than none.
 */
export function loadRoster(workspace) {
  if (!fs.existsSync(workspace.rosterPath)) return null;
  let roster;
  try {
    roster = readJson(workspace.rosterPath);
  } catch (error) {
    throw new A19PanelError(`roster is not valid JSON: ${repoRel(workspace.rosterPath)} (${error.message})`, {
      status: 500,
      code: 'roster_invalid_json',
    });
  }
  if (roster.schema_version !== ROSTER_SCHEMA_VERSION) {
    throw new A19PanelError(`roster schema_version must be ${ROSTER_SCHEMA_VERSION}`, {
      status: 500,
      code: 'roster_schema_version',
    });
  }
  const coders = Array.isArray(roster.coders) ? roster.coders : null;
  if (!coders) {
    throw new A19PanelError('roster.coders must be an array', { status: 500, code: 'roster_coders_missing' });
  }
  const seenIds = new Set();
  const seenKeys = new Set();
  for (const coder of coders) {
    const coderId = safeCoderId(coder.coder_id);
    if (coderId !== coder.coder_id) {
      throw new A19PanelError(`roster coder_id contains unsafe characters: ${coder.coder_id}`, {
        status: 500,
        code: 'roster_coder_id_unsafe',
      });
    }
    if (seenIds.has(coderId)) {
      throw new A19PanelError(`roster has duplicate coder_id: ${coderId}`, {
        status: 500,
        code: 'roster_duplicate_id',
      });
    }
    seenIds.add(coderId);
    if (typeof coder.access_key !== 'string' || coder.access_key.length < MIN_ACCESS_KEY_LENGTH) {
      throw new A19PanelError(`roster access_key for ${coderId} must be at least ${MIN_ACCESS_KEY_LENGTH} chars`, {
        status: 500,
        code: 'roster_key_too_short',
      });
    }
    if (seenKeys.has(coder.access_key)) {
      throw new A19PanelError('roster has duplicate access keys', { status: 500, code: 'roster_duplicate_key' });
    }
    seenKeys.add(coder.access_key);
    if (!Array.isArray(coder.assignments)) {
      throw new A19PanelError(`roster coder ${coderId} needs an assignments array`, {
        status: 500,
        code: 'roster_assignments_missing',
      });
    }
    coder.assignments.forEach((slug) => safeSlug(slug));
  }
  return roster;
}

/**
 * Look a coder up by access key. Scans every entry with a constant-time
 * compare (no early return) so a non-matching key costs the same regardless
 * of how far it got. Returns the roster coder object or null.
 */
export function findCoderByKey(roster, accessKey) {
  if (!roster || typeof accessKey !== 'string' || !accessKey) return null;
  let match = null;
  for (const coder of roster.coders) {
    if (safeEqual(coder.access_key, accessKey)) match = coder;
  }
  return match;
}

// ---------------------------------------------------------------------------
// Assignments — discovery + serving-time blind enforcement
// ---------------------------------------------------------------------------

/**
 * List assignment files in the workspace. `*.assignment-key.json` files do
 * not match the `.assignment.json` suffix, but they are also excluded by an
 * explicit guard so a rename can never quietly turn a key file into a
 * servable assignment.
 */
export function discoverAssignments(workspace) {
  if (!fs.existsSync(workspace.assignmentsDir)) return [];
  return fs
    .readdirSync(workspace.assignmentsDir)
    .filter((entry) => entry.endsWith('.assignment.json') && !entry.includes('assignment-key'))
    .sort()
    .map((entry) => ({
      slug: assignmentSlug(entry),
      path: path.join(workspace.assignmentsDir, entry),
    }));
}

function collectPrivateFieldNames(value, found, keyPath = '') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectPrivateFieldNames(entry, found, `${keyPath}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const childPath = keyPath ? `${keyPath}.${key}` : key;
      if (PRIVATE_FIELD_NAMES.has(key)) found.push(childPath);
      collectPrivateFieldNames(child, found, childPath);
    }
  }
}

function pick(source, fields) {
  const out = {};
  for (const field of fields) {
    if (source[field] !== undefined) out[field] = source[field];
  }
  return out;
}

/**
 * Enforce blinding at serving time. Projects the assignment onto the public
 * field allowlist, then screens the projected payload with the validator's
 * forbidden-marker regexes. Throws A19PanelError (503-style refusal) when the
 * file carries key material — a leaky assignment must never reach a coder.
 */
export function sanitizeAssignment(assignment, { sourcePath = null } = {}) {
  const privateFields = [];
  collectPrivateFieldNames(assignment, privateFields);
  if (privateFields.length) {
    throw new A19PanelError(
      `assignment contains private key material (${privateFields.join(', ')}); refusing to serve` +
        (sourcePath ? ` ${repoRel(sourcePath)}` : ''),
      { status: 500, code: 'assignment_private_fields', details: { private_fields: privateFields } },
    );
  }
  const sanitized = pick(assignment, PUBLIC_ASSIGNMENT_FIELDS);
  sanitized.arms = (Array.isArray(assignment.arms) ? assignment.arms : []).map((arm) => pick(arm, PUBLIC_ARM_FIELDS));
  const serialized = JSON.stringify(sanitized);
  const markerHits = FORBIDDEN_PRIVATE_MARKERS.filter((marker) => marker.test(serialized)).map((marker) =>
    String(marker),
  );
  if (markerHits.length) {
    throw new A19PanelError(
      `assignment text trips private markers (${markerHits.join(', ')}); refusing to serve` +
        (sourcePath ? ` ${repoRel(sourcePath)}` : ''),
      { status: 500, code: 'assignment_marker_leak', details: { markers: markerHits } },
    );
  }
  return sanitized;
}

/**
 * Resolve one slug to its sanitized assignment + codebook + submission dir.
 * Membership in the discovered set is checked BEFORE touching the filesystem
 * with the slug, so a crafted slug cannot path-traverse.
 */
export function getAssignment(workspace, rawSlug) {
  const slug = safeSlug(rawSlug);
  const discovered = discoverAssignments(workspace).find((entry) => entry.slug === slug);
  if (!discovered) {
    throw new A19PanelError(`unknown assignment: ${slug}`, { status: 404, code: 'assignment_not_found' });
  }
  const raw = readJson(discovered.path);
  const assignment = sanitizeAssignment(raw, { sourcePath: discovered.path });
  const codebookPath = resolveCodebookPath(workspace, assignment);
  if (!fs.existsSync(codebookPath)) {
    throw new A19PanelError(`codebook not found: ${repoRel(codebookPath)}`, {
      status: 500,
      code: 'codebook_not_found',
    });
  }
  const codebook = readJson(codebookPath);
  return {
    slug,
    assignment,
    codebook,
    assignmentPath: discovered.path,
    codebookPath,
    submissionDir: submissionDirForSlug(workspace, slug),
  };
}

// ---------------------------------------------------------------------------
// Drafts — resume/progress state
// ---------------------------------------------------------------------------

function draftPath(submissionDir, coderId) {
  return path.join(submissionDir, '.drafts', `${coderId}.draft.json`);
}

export function readDraft({ submissionDir, coderId }) {
  const filePath = draftPath(submissionDir, safeCoderId(coderId));
  if (!fs.existsSync(filePath)) return null;
  return readJson(filePath);
}

export function writeDraft({ submissionDir, coderId, slug, assignmentId, payload }) {
  const id = safeCoderId(coderId);
  const serialized = JSON.stringify(payload ?? null);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_DRAFT_BYTES) {
    throw new A19PanelError(`draft exceeds ${MAX_DRAFT_BYTES} bytes`, { status: 413, code: 'draft_too_large' });
  }
  const draft = {
    schema_version: DRAFT_SCHEMA_VERSION,
    assignment_slug: slug,
    assignment_id: assignmentId || null,
    coder_id: id,
    updated_at: new Date().toISOString(),
    payload: payload ?? null,
  };
  writeJsonAtomic(draftPath(submissionDir, id), draft);
  return draft;
}

export function deleteDraft({ submissionDir, coderId }) {
  const filePath = draftPath(submissionDir, safeCoderId(coderId));
  if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
}

// ---------------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------------

export function listSubmissions({ assignmentPath, codebookPath, submissionDir }) {
  if (!fs.existsSync(submissionDir)) return [];
  return fs
    .readdirSync(submissionDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort()
    .map((entry) => {
      const coderPath = path.join(submissionDir, entry);
      let validation = null;
      try {
        validation = validateA19HumanCoderFile({ assignmentPath, coderPath, codebookPath });
      } catch (error) {
        validation = {
          status: 'fail',
          issues: [{ severity: 'error', path: repoRel(coderPath), message: error.message }],
        };
      }
      return {
        coder_id: entry.replace(/\.json$/u, ''),
        path: repoRel(coderPath),
        status: validation.status,
        issues: validation.issues || [],
      };
    });
}

/**
 * Build, validate, and atomically persist one coder submission. The tmp file
 * is validated BEFORE the rename, so an invalid submission never exists at
 * the final path. On success the coder's draft for this slug is removed.
 */
export function writeSubmission({
  assignmentPath,
  codebookPath,
  submissionDir,
  coderId,
  coderRole,
  armJudgments,
  pairwiseJudgment,
  codebookFeedback,
  overwrite = false,
}) {
  const id = safeCoderId(coderId);
  const assignment = readJson(assignmentPath);
  const codebook = readJson(codebookPath);
  fs.mkdirSync(submissionDir, { recursive: true });
  const outPath = path.join(submissionDir, `${id}.json`);
  if (fs.existsSync(outPath) && !overwrite) {
    throw new A19PanelError(`coder submission already exists: ${repoRel(outPath)}`, {
      status: 409,
      code: 'A19_CODER_EXISTS',
    });
  }
  const coder = buildCoderSubmission({
    assignment,
    codebook,
    coderId: id,
    coderRole: coderRole || 'expert_or_semi_expert',
    armJudgments: Array.isArray(armJudgments) ? armJudgments : [],
    pairwiseJudgment: pairwiseJudgment || {},
    codebookFeedback: codebookFeedback || { ambiguous_terms: [], suggested_revision: '' },
  });
  const tmpPath = path.join(submissionDir, `.${id}.${Date.now()}.tmp.json`);
  let validation;
  try {
    fs.writeFileSync(tmpPath, `${JSON.stringify(coder, null, 2)}\n`, 'utf8');
    validation = validateA19HumanCoderFile({ assignmentPath, coderPath: tmpPath, codebookPath });
    if (validation.status !== 'pass') {
      fs.rmSync(tmpPath, { force: true });
      return { ok: false, validation };
    }
    fs.renameSync(tmpPath, outPath);
  } catch (error) {
    fs.rmSync(tmpPath, { force: true });
    throw error;
  }
  deleteDraft({ submissionDir, coderId: id });
  return { ok: true, coderPath: outPath, validation: { ...validation, coder_path: repoRel(outPath) } };
}

// ---------------------------------------------------------------------------
// Worklist + panel completeness
// ---------------------------------------------------------------------------

function coderStatusForSlug(workspace, slug, coderId) {
  const submissionDir = submissionDirForSlug(workspace, slug);
  const discovered = discoverAssignments(workspace).find((entry) => entry.slug === slug);
  if (!discovered) {
    return { slug, status: 'missing', validation_status: null, draft_updated_at: null };
  }
  const submissionPath = path.join(submissionDir, `${coderId}.json`);
  if (fs.existsSync(submissionPath)) {
    let validation;
    try {
      const assignment = readJson(discovered.path);
      validation = validateA19HumanCoderFile({
        assignmentPath: discovered.path,
        coderPath: submissionPath,
        codebookPath: resolveCodebookPath(workspace, assignment),
      });
    } catch (error) {
      validation = {
        status: 'fail',
        issues: [{ severity: 'error', path: repoRel(submissionPath), message: error.message }],
      };
    }
    return {
      slug,
      status: 'submitted',
      validation_status: validation.status,
      draft_updated_at: null,
      submission_path: repoRel(submissionPath),
    };
  }
  const draft = fs.existsSync(path.join(submissionDir, '.drafts', `${coderId}.draft.json`))
    ? readDraft({ submissionDir, coderId })
    : null;
  if (draft) {
    return { slug, status: 'draft', validation_status: null, draft_updated_at: draft.updated_at || null };
  }
  return { slug, status: 'not_started', validation_status: null, draft_updated_at: null };
}

function assignmentHeader(workspace, slug) {
  const discovered = discoverAssignments(workspace).find((entry) => entry.slug === slug);
  if (!discovered) return { slug, missing: true };
  try {
    const raw = readJson(discovered.path);
    return {
      slug,
      missing: false,
      assignment_id: raw.assignment_id || null,
      packet_id: raw.packet_id || null,
      arm_count: Array.isArray(raw.arms) ? raw.arms.length : 0,
    };
  } catch (error) {
    return { slug, missing: true, error: error.message };
  }
}

/**
 * Worklist for one coder. Keyed mode passes the roster coder (assignment set
 * fixed by the roster); open mode passes { coderId } from a self-asserted
 * identity, with the full discovered set as the worklist.
 */
export function coderWorklist(workspace, { coder = null, coderId = null } = {}) {
  const id = coder ? coder.coder_id : coderId ? safeCoderId(coderId) : null;
  const slugs = coder ? coder.assignments : discoverAssignments(workspace).map((entry) => entry.slug);
  return slugs.map((slug) => {
    const header = assignmentHeader(workspace, slug);
    if (header.missing) {
      return { ...header, status: 'missing', validation_status: null, draft_updated_at: null };
    }
    if (!id) {
      const submissionDir = submissionDirForSlug(workspace, slug);
      const discovered = discoverAssignments(workspace).find((entry) => entry.slug === slug);
      const assignment = readJson(discovered.path);
      const submissions = listSubmissions({
        assignmentPath: discovered.path,
        codebookPath: resolveCodebookPath(workspace, assignment),
        submissionDir,
      });
      return {
        ...header,
        status: null,
        validation_status: null,
        draft_updated_at: null,
        submission_count: submissions.length,
        valid_submission_count: submissions.filter((entry) => entry.status === 'pass').length,
      };
    }
    return { ...header, ...coderStatusForSlug(workspace, slug, id) };
  });
}

export function loadAgreementThresholds(workspace) {
  const fallback = { minimum_coders_for_claim: 2, high_value_claim_target_coders: 3 };
  try {
    if (!fs.existsSync(workspace.panelConfigPath)) return fallback;
    const doc = parseYaml(fs.readFileSync(workspace.panelConfigPath, 'utf8'));
    const plan = doc?.agreement_plan || {};
    return {
      minimum_coders_for_claim: Number(plan.minimum_coders_for_claim) || fallback.minimum_coders_for_claim,
      high_value_claim_target_coders:
        Number(plan.high_value_claim_target_coders) || fallback.high_value_claim_target_coders,
    };
  } catch {
    return fallback;
  }
}

/**
 * Admin-only completeness matrix: every discovered assignment × every coder
 * who is rostered onto it or has a submission file on disk (CLI-written
 * coders count toward completeness exactly like dashboard ones — the merge
 * script reads both identically). No access keys appear anywhere in the
 * result.
 */
export function panelStatus(workspace, { roster = null } = {}) {
  const thresholds = loadAgreementThresholds(workspace);
  const assignments = discoverAssignments(workspace).map(({ slug, path: assignmentPath }) => {
    const header = assignmentHeader(workspace, slug);
    const assignment = readJson(assignmentPath);
    const codebookPath = resolveCodebookPath(workspace, assignment);
    const submissionDir = submissionDirForSlug(workspace, slug);
    const submissions = listSubmissions({ assignmentPath, codebookPath, submissionDir });
    const rosterCoders = roster ? roster.coders.filter((coder) => coder.assignments.includes(slug)) : [];
    const submissionIds = new Set(submissions.map((entry) => entry.coder_id));
    const coders = rosterCoders.map((coder) => ({
      coder_id: coder.coder_id,
      coder_role: coder.coder_role || null,
      source: 'roster',
      ...coderStatusForSlug(workspace, slug, coder.coder_id),
    }));
    for (const submission of submissions) {
      if (!rosterCoders.some((coder) => coder.coder_id === submission.coder_id)) {
        coders.push({
          coder_id: submission.coder_id,
          coder_role: null,
          source: 'file',
          slug,
          status: 'submitted',
          validation_status: submission.status,
          draft_updated_at: null,
          submission_path: submission.path,
        });
      }
    }
    const validCount = submissions.filter((entry) => entry.status === 'pass').length;
    return {
      ...header,
      submission_count: submissionIds.size,
      valid_submission_count: validCount,
      meets_minimum: validCount >= thresholds.minimum_coders_for_claim,
      meets_high_value_target: validCount >= thresholds.high_value_claim_target_coders,
      coders,
    };
  });
  return {
    thresholds,
    assignments,
    roster_coders: roster
      ? roster.coders.map((coder) => ({
          coder_id: coder.coder_id,
          coder_role: coder.coder_role || null,
          assignments: coder.assignments,
        }))
      : [],
  };
}

export { nextCoderId, DEFAULT_ASSIGNMENT, DEFAULT_CODEBOOK };
